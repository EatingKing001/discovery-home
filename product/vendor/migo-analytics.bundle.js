(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.MigoAnalytics = {}));
})(this, (function (exports) { 'use strict';

    /**
     * 将接入应用提供的简化身份参数统一转换成内部三态模型。
     *
     * 处理规则：
     * 1. 已经是 `{ status: ... }` 的内部状态时直接返回，避免重复转换。
     * 2. `resolving: true` 表示业务仍在查询登录态，此时不能按匿名用户发送事件。
     * 3. 登录态查询结束后，没有 userId 就进入 anonymous，保留神策生成的匿名 ID。
     * 4. 有 userId 时统一转为字符串，进入 identified，后续由状态机调用 sensors.login。
     */
    const normalizeIdentity = (identity) => {
        if ('status' in identity)
            return identity;
        if (identity.resolving)
            return { status: 'resolving' };
        const userId = identity.userId;
        if (userId === null || userId === undefined || userId === '') {
            return { status: 'anonymous' };
        }
        return { status: 'identified', userId: String(userId) };
    };

    /**
     * 获取适合计算耗时的单调时钟。
     * 浏览器优先使用 performance.now()，避免用户修改系统时间导致 duration 出现负数或突变；
     * 非浏览器环境回退到 Date.now()，便于单元测试或其他 JavaScript 运行时使用。
     */
    const getMonotonicTime = () => {
        if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
            return performance.now();
        }
        return Date.now();
    };
    /**
     * 把身份状态转换成可比较的稳定 key。
     * identified 状态必须包含 userId，否则 user-A 切换到 user-B 时会被误判为同一状态。
     */
    const getIdentityKey = (identity) => {
        if (identity.status === 'identified')
            return `identified:${identity.userId}`;
        return identity.status;
    };
    /**
     * 与具体数据平台无关的埋点客户端。
     *
     * 它负责队列、身份顺序、耗时统计和生命周期；真正的神策调用由 AnalyticsTransport 完成。
     * 这种分层使 core 可以复用于其他埋点平台，也便于通过假 Transport 做单元测试。
     */
    class AnalyticsClient {
        /**
         * 创建客户端并立即异步初始化 Transport。
         *
         * 构造函数同步返回，因此业务可以马上调用 track；初始化期间产生的操作先进入 queue。
         * `ready` 只表示底层 SDK 初始化流程完成，队列是否能发送还取决于身份是否离开 resolving。
         */
        constructor(options) {
            this.identityVersion = 0;
            this.appliedIdentityKey = null;
            this.transportReady = false;
            this.autoTrackStarted = false;
            this.destroyed = false;
            this.queue = [];
            this.operationChain = Promise.resolve();
            this.cleanups = [];
            this.options = {
                ...options,
                maxQueueSize: Math.max(1, options.maxQueueSize ?? 1000),
            };
            this.identity = normalizeIdentity(options.identity ?? { status: 'resolving' });
            this.ready = Promise.resolve()
                .then(() => options.transport.initialize())
                .then(() => {
                this.transportReady = true;
                return this.scheduleDrain();
            })
                .catch((error) => {
                this.reportError(error, { phase: 'initialize' });
                throw error;
            });
            // The public ready promise remains rejectable, while this handler prevents an
            // unhandled rejection in applications that intentionally use fire-and-forget init.
            this.ready.catch(() => undefined);
        }
        /**
         * 记录自定义事件。
         *
         * 这里只负责记录事件发生时刻、合并公共属性并入队，不直接调用神策。
         * commonProperties 在前、事件属性在后，因此具体事件可以覆盖同名公共属性。
         */
        track(eventName, properties = {}) {
            if (!eventName || this.destroyed)
                return;
            this.enqueue({
                type: 'track',
                eventName,
                properties: {
                    ...this.options.commonProperties,
                    ...properties,
                },
                occurredAt: new Date(),
            });
        }
        /**
         * 更新当前身份状态并触发一次串行 drain。
         *
         * 相同身份不会重复执行 sensors.login；真正变更时递增 identityVersion，
         * 让正在等待的旧 login 流程能够识别自己已经过期，并在发送事件前修正到最新身份。
         */
        setIdentity(identity) {
            if (this.destroyed)
                return;
            const nextIdentity = normalizeIdentity(identity);
            if (getIdentityKey(nextIdentity) === getIdentityKey(this.identity))
                return;
            this.identity = nextIdentity;
            this.identityVersion += 1;
            void this.scheduleDrain();
        }
        /**
         * 同步读取当前“期望身份”。
         * 注意它表示应用最新提交的状态，不一定等于底层 SDK 此刻已经应用完成的身份。
         */
        getIdentity() {
            return this.identity;
        }
        /**
         * 设置用户属性，已有属性值允许被覆盖。
         * Profile 操作和事件共用同一队列，确保初始化与身份确认之前不会提前写到错误用户。
         */
        setProfile(properties) {
            if (this.destroyed)
                return;
            this.enqueue({ type: 'profile', mode: 'set', properties });
        }
        /**
         * 首次设置用户属性，底层适配器会映射到神策 setOnceProfile。
         * 常用于首次上传、首次使用某功能等只写一次的用户画像字段。
         */
        setProfileOnce(properties) {
            if (this.destroyed)
                return;
            this.enqueue({ type: 'profile', mode: 'setOnce', properties });
        }
        /**
         * 创建一个异步操作计时器。
         *
         * 调用时只保存开始时间，不立即上报；业务在成功、失败或取消时结束 span。
         * settled 保证同一个 span 最多产生一条事件，避免 finally/end 等路径重复上报。
         */
        startSpan(eventName, properties = {}) {
            const startedAt = getMonotonicTime();
            let settled = false;
            /** 汇总公共属性、结束属性与耗时，并通过普通 track 流程上报。 */
            const complete = (status, extraProperties = {}) => {
                if (settled)
                    return;
                settled = true;
                this.track(eventName, {
                    ...properties,
                    ...extraProperties,
                    status,
                    duration_ms: Math.max(0, Math.round(getMonotonicTime() - startedAt)),
                });
            };
            return {
                /** 正常结束计时并上报 status=success。 */
                end: (extraProperties) => complete('success', extraProperties),
                /** 失败结束计时；Error 会被拆成 error_name 和 error_message。 */
                fail: (error, extraProperties) => {
                    const errorProperties = {};
                    if (error instanceof Error) {
                        errorProperties.error_name = error.name;
                        errorProperties.error_message = error.message;
                    }
                    else if (error !== undefined) {
                        errorProperties.error_message = String(error);
                    }
                    complete('error', { ...errorProperties, ...extraProperties });
                },
                /** 取消本次计时，不产生埋点事件。 */
                cancel: () => {
                    settled = true;
                },
            };
        }
        /**
         * 请求处理一次当前队列，并返回这次串行处理完成后的 Promise。
         * resolving 状态下会正常返回，但事件仍保留在队列中，等待下一次身份更新。
         */
        flush() {
            return this.scheduleDrain();
        }
        /**
         * 注册销毁回调。
         * bootstrap 用它卸载 DOM 监听器并清理全局单例，其他扩展层也可注册自己的清理逻辑。
         */
        addCleanup(cleanup) {
            this.cleanups.push(cleanup);
        }
        /**
         * 销毁客户端。
         * 先阻止新操作并清空未发送队列，再并行执行扩展层清理，最后通知底层 Transport 释放资源。
         */
        async destroy() {
            if (this.destroyed)
                return;
            this.destroyed = true;
            this.queue = [];
            await Promise.allSettled(this.cleanups.map((cleanup) => Promise.resolve().then(cleanup)));
            this.cleanups = [];
            await this.options.transport.destroy?.();
        }
        /**
         * 将事件或 Profile 操作加入有界队列。
         * 队列达到上限时丢弃最旧操作并通过 onError 告警，避免 SDK 长时间不可用造成内存无限增长。
         */
        enqueue(operation) {
            if (this.queue.length >= this.options.maxQueueSize) {
                this.queue.shift();
                this.reportError(new Error('Analytics queue capacity exceeded; oldest operation dropped'), {
                    phase: 'queue',
                });
            }
            this.queue.push(operation);
            void this.scheduleDrain();
        }
        /**
         * 把 drain 串到 operationChain 尾部。
         * 所有初始化后处理、login/logout、autoTrack 与事件发送因此严格串行，不会并发抢占身份顺序。
         */
        scheduleDrain() {
            this.operationChain = this.operationChain.then(() => this.drain());
            return this.operationChain;
        }
        /**
         * 队列消费主循环。
         *
         * 顺序固定为：确认 Transport 可用 → 等待身份解析 → 应用身份 → 开启 autoTrack → 发送一个操作。
         * 每次异步边界后都会检查 identityVersion；发现身份变化就回到循环顶部，先修正身份再继续发事件。
         */
        async drain() {
            if (!this.transportReady || this.destroyed)
                return;
            while (!this.destroyed) {
                const identity = this.identity;
                const version = this.identityVersion;
                if (identity.status === 'resolving')
                    return;
                const identityApplied = await this.applyIdentity(identity, version);
                if (!identityApplied) {
                    if (version !== this.identityVersion)
                        continue;
                    return;
                }
                if (!this.autoTrackStarted && this.options.transport.startAutoTrack) {
                    try {
                        await this.options.transport.startAutoTrack();
                        this.autoTrackStarted = true;
                    }
                    catch (error) {
                        this.reportError(error, { phase: 'autoTrack' });
                    }
                }
                if (version !== this.identityVersion)
                    continue;
                const operation = this.queue.shift();
                if (!operation)
                    return;
                try {
                    if (operation.type === 'track') {
                        await this.options.transport.track({
                            name: operation.eventName,
                            properties: operation.properties,
                            occurredAt: operation.occurredAt,
                        });
                    }
                    else if (operation.mode === 'set') {
                        await this.options.transport.setProfile?.(operation.properties);
                    }
                    else {
                        await this.options.transport.setProfileOnce?.(operation.properties);
                    }
                }
                catch (error) {
                    const context = operation.type === 'track'
                        ? { phase: 'track', eventName: operation.eventName }
                        : { phase: 'profile' };
                    this.reportError(error, context);
                }
            }
        }
        /**
         * 将期望身份同步到底层 Transport。
         *
         * anonymous 初始态不会主动 logout，因此神策自动生成的匿名 ID 得以保留；
         * 只有底层曾经应用 identified 后切回 anonymous，才调用 resetIdentity。
         * 即使 identify 等待期间版本变化，仍记录底层已经执行过的身份，下一轮才能正确补偿 logout/login。
         */
        async applyIdentity(identity, version) {
            const nextKey = getIdentityKey(identity);
            if (nextKey === this.appliedIdentityKey)
                return true;
            try {
                if (identity.status === 'identified') {
                    await this.options.transport.identify?.(identity.userId);
                }
                else if (this.appliedIdentityKey?.startsWith('identified:')) {
                    await this.options.transport.resetIdentity?.();
                }
            }
            catch (error) {
                this.reportError(error, { phase: 'identity' });
                return false;
            }
            this.appliedIdentityKey = nextKey;
            return version === this.identityVersion;
        }
        /**
         * 将内部错误交给接入方提供的统一错误回调。
         * core 默认不 console、不抛到业务交互链路，避免埋点失败影响正常功能。
         */
        reportError(error, context) {
            this.options.onError?.(error, context);
        }
    }

    const propertyResolvers = new WeakMap();
    /**
     * 为某个真实 DOM 元素注册动态属性解析函数。
     *
     * React Hook 会把最新 props/state 保存在闭包中，而 DOM AOP 在用户真正交互时才调用 resolver，
     * 因此业务不必在 onClick 中手动 track，也不会因为预先序列化而拿到过期值。
     * WeakMap 不会阻止已经卸载的 DOM 元素被垃圾回收。
     *
     * 返回的 cleanup 只删除自己注册的 resolver，避免旧组件的清理误删同一元素上的新注册。
     */
    const registerAnalyticsProperties = (element, resolver) => {
        propertyResolvers.set(element, resolver);
        return () => {
            if (propertyResolvers.get(element) === resolver) {
                propertyResolvers.delete(element);
            }
        };
    };
    /**
     * 在事件发生时读取元素对应的动态属性。
     * 没有注册 resolver 时返回 undefined，由 DOM 采集器继续使用声明式静态属性。
     */
    const resolveAnalyticsProperties = (element) => propertyResolvers.get(element)?.();

    const EVENT_ATTRIBUTE = 'data-analytics-event';
    const TRIGGER_ATTRIBUTE = 'data-analytics-trigger';
    const PROPERTY_ATTRIBUTE_PREFIX = 'data-analytics-prop-';
    const SUPPORTED_EVENTS = ['click', 'change', 'submit', 'focus', 'focusout', 'copy', 'drop'];
    /**
     * 将 DOM attribute 的字符串值做保守类型恢复。
     * 只自动识别严格的 boolean、null 和标准数字字符串，其余原样保留，避免诸如 001 这类业务编码被错误转成 1。
     */
    const parseAttributeValue = (value) => {
        if (value === 'true')
            return true;
        if (value === 'false')
            return false;
        if (value === 'null')
            return null;
        if (value !== '' && String(Number(value)) === value)
            return Number(value);
        return value;
    };
    /**
     * 读取元素上的声明式静态埋点属性。
     *
     * 支持两种写法：
     * - data-analytics-properties='{"paper_id":"1"}'：一次声明多个字段；
     * - data-analytics-prop-source="detail"：单字段声明，更适合 JSX。
     *
     * 单字段属性后合并，因此同名时会覆盖 JSON 中的值。非法 JSON 会被忽略，不能影响业务点击。
     */
    const getStaticProperties = (element) => {
        const properties = {};
        const serializedProperties = element.getAttribute('data-analytics-properties');
        if (serializedProperties) {
            try {
                const parsed = JSON.parse(serializedProperties);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    Object.assign(properties, parsed);
                }
            }
            catch {
                // Invalid declarative properties must not break the interaction itself.
            }
        }
        Array.from(element.attributes).forEach((attribute) => {
            if (!attribute.name.startsWith(PROPERTY_ATTRIBUTE_PREFIX))
                return;
            const propertyName = attribute.name.slice(PROPERTY_ATTRIBUTE_PREFIX.length);
            if (propertyName)
                properties[propertyName] = parseAttributeValue(attribute.value);
        });
        return properties;
    };
    /**
     * 生成最终事件属性。
     * 合并顺序为静态属性 → React/组件动态属性 → 基础设施触发类型，动态值可以覆盖静态默认值。
     * resolver 异常会被吞掉，保证埋点元数据计算失败时用户交互仍能继续。
     */
    const getEventProperties = (element, trigger) => {
        let dynamicProperties;
        try {
            dynamicProperties = resolveAnalyticsProperties(element);
        }
        catch {
            // Analytics metadata must never interrupt the user's interaction.
        }
        return {
            ...getStaticProperties(element),
            ...dynamicProperties,
            analytics_trigger: trigger,
        };
    };
    /** 判断候选元素是否属于本采集器负责的 root，防止事件代理越过应用边界。 */
    const isInsideRoot = (element, root) => {
        if (root instanceof Document)
            return root.documentElement.contains(element);
        return root === element || root.contains(element);
    };
    /**
     * 从浏览器事件中定位最近的声明式埋点元素。
     *
     * 优先遍历 composedPath，以兼容元素内部嵌套图标等点击目标；没有 composedPath 时回退到 closest。
     * 遍历只在 root 内进行，因此多个局部采集器可以各自管理自己的 DOM 子树。
     */
    const findTrackedElement = (event, root) => {
        const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
        for (const target of path) {
            if (!(target instanceof Element))
                continue;
            if (!isInsideRoot(target, root))
                break;
            if (target.hasAttribute(EVENT_ATTRIBUTE))
                return target;
        }
        const target = event.target;
        if (!(target instanceof Element))
            return null;
        const trackedElement = target.closest(`[${EVENT_ATTRIBUTE}]`);
        return trackedElement && isInsideRoot(trackedElement, root) ? trackedElement : null;
    };
    /**
     * 扫描当前 root 中所有声明为 exposure 的元素。
     * querySelectorAll 不包含 root 自身，所以 HTMLElement root 需要额外判断并补入结果。
     */
    const getExposureElements = (root) => {
        const selector = `[${EVENT_ATTRIBUTE}][${TRIGGER_ATTRIBUTE}="exposure"]`;
        const elements = Array.from(root.querySelectorAll(selector));
        if (root instanceof HTMLElement && root.matches(selector))
            elements.unshift(root);
        return elements;
    };
    /**
     * 安装基于事件代理和观察器的 DOM AOP 采集。
     *
     * 普通交互只在 root 上各注册一个捕获阶段监听器，无论页面上有多少埋点元素都不增加监听器数量；
     * 曝光使用 IntersectionObserver 判断可见比例，并配合定时器校验连续可见时长；
     * MutationObserver 只负责发现后续动态挂载的曝光元素。
     *
     * 返回统一 cleanup，供 AnalyticsClient.destroy() 一次性释放所有浏览器资源。
     */
    const installDomCollector = (analytics, options = {}) => {
        if (typeof document === 'undefined')
            return () => undefined;
        const root = options.root ?? document;
        const listeners = [];
        SUPPORTED_EVENTS.forEach((type) => {
            /**
             * 捕获阶段事件代理函数：寻找埋点元素、校验 trigger，然后交给统一 Analytics 客户端。
             * 它不调用 preventDefault/stopPropagation，不会改变业务自身的冒泡与默认行为。
             */
            const listener = (event) => {
                const element = findTrackedElement(event, root);
                if (!element)
                    return;
                const configuredTrigger = (element.getAttribute(TRIGGER_ATTRIBUTE) || 'click');
                if (configuredTrigger !== type)
                    return;
                const eventName = element.getAttribute(EVENT_ATTRIBUTE);
                if (eventName)
                    analytics.track(eventName, getEventProperties(element, type));
            };
            root.addEventListener(type, listener, true);
            listeners.push({ type, listener });
        });
        const exposureTimers = new Map();
        const exposedOnce = new WeakSet();
        let exposureObserver;
        let mutationObserver;
        if (typeof IntersectionObserver !== 'undefined') {
            const threshold = Math.min(1, Math.max(0, options.exposureThreshold ?? 0.5));
            const duration = Math.max(0, options.exposureDurationMs ?? 500);
            exposureObserver = new IntersectionObserver(
            /**
             * 曝光状态回调：达到阈值后启动持续时间计时，离开视口立即取消。
             * 计时完成时再次确认元素仍在文档中；默认一次曝光后 unobserve，显式 once=false 才允许重复曝光。
             */
            (entries) => {
                entries.forEach((entry) => {
                    const element = entry.target;
                    const timer = exposureTimers.get(element);
                    const isVisible = entry.isIntersecting && entry.intersectionRatio >= threshold;
                    if (!isVisible) {
                        if (timer)
                            clearTimeout(timer);
                        exposureTimers.delete(element);
                        return;
                    }
                    if (timer || exposedOnce.has(element))
                        return;
                    const nextTimer = setTimeout(() => {
                        exposureTimers.delete(element);
                        const eventName = element.getAttribute(EVENT_ATTRIBUTE);
                        if (!eventName || !element.isConnected)
                            return;
                        analytics.track(eventName, getEventProperties(element, 'exposure'));
                        const isOnce = element.getAttribute('data-analytics-once') !== 'false';
                        if (isOnce) {
                            exposedOnce.add(element);
                            exposureObserver?.unobserve(element);
                        }
                    }, duration);
                    exposureTimers.set(element, nextTimer);
                });
            }, {
                root: root instanceof Document ? null : root,
                threshold,
            });
            /**
             * 扫描并观察当前所有曝光节点。
             * IntersectionObserver.observe 对同一元素重复调用是幂等的，因此可安全地作为 MutationObserver 回调复用。
             */
            const observeExposureElements = () => {
                getExposureElements(root).forEach((element) => {
                    if (!exposedOnce.has(element))
                        exposureObserver?.observe(element);
                });
            };
            observeExposureElements();
            if (typeof MutationObserver !== 'undefined') {
                mutationObserver = new MutationObserver(observeExposureElements);
                mutationObserver.observe(root, { childList: true, subtree: true, attributes: true });
            }
        }
        /** 卸载全部事件监听、计时器和观察器，防止应用卸载后继续上报或持有 DOM 引用。 */
        return () => {
            listeners.forEach(({ type, listener }) => root.removeEventListener(type, listener, true));
            exposureTimers.forEach((timer) => clearTimeout(timer));
            exposureTimers.clear();
            exposureObserver?.disconnect();
            mutationObserver?.disconnect();
        };
    };

    const REGISTRY_SYMBOL = Symbol.for('@migo/analytics/instances');
    /**
     * 获取跨 bundle 共享的 Analytics 实例表。
     *
     * 使用 Symbol.for 而不是模块内普通变量，是为了兼容微前端中同一包被 Host、子应用各打包一份的情况：
     * 只要处于同一个 window/globalThis，它们就会命中同一个 Symbol 和 Map，避免重复加载 SDK、重复监听 DOM。
     */
    const getRegistry = () => {
        const root = globalThis;
        if (!root[REGISTRY_SYMBOL])
            root[REGISTRY_SYMBOL] = new Map();
        return root[REGISTRY_SYMBOL];
    };
    /**
     * 按 instanceKey 读取已初始化的客户端。
     * 默认 key 为 default；普通页面通常只需要一个实例，多租户或多数据源页面才需要自定义 key。
     */
    const getAnalytics = (instanceKey = 'default') => getRegistry().get(instanceKey);
    /**
     * 创建页面级 Analytics 单例并安装可选的 DOM 采集器。
     *
     * 如果相同 instanceKey 已存在则直接复用，调用方不需要自行实现 once 防重。
     * 初始化失败时会删除失败实例并销毁监听器，使后续再次 bootstrap 可以真正重试加载。
     */
    const bootstrapAnalytics = (options) => {
        const instanceKey = options.instanceKey ?? 'default';
        const registry = getRegistry();
        const existing = registry.get(instanceKey);
        if (existing)
            return existing;
        const client = new AnalyticsClient(options);
        registry.set(instanceKey, client);
        void client.ready.catch(async () => {
            if (registry.get(instanceKey) === client)
                registry.delete(instanceKey);
            await client.destroy();
        });
        if (options.dom !== false) {
            const cleanup = installDomCollector(client, options.dom === true || options.dom === undefined ? {} : options.dom);
            client.addCleanup(cleanup);
        }
        client.addCleanup(() => {
            if (registry.get(instanceKey) === client)
                registry.delete(instanceKey);
        });
        return client;
    };

    const DEFAULT_SENSORS_SCRIPT_URL = 'https://static.openxlab.org.cn/migo-web/sensors/sensorsdata.min.js';
    const DEFAULT_SENSORS_SERVER_URL = 'https://sensorsdata.intern-ai.org.cn/sa';
    const SCRIPT_PROMISE_SYMBOL = Symbol.for('@migo/analytics/sensors-script-promises');
    /**
     * 获取跨 bundle 共享的 script 加载 Promise 表。
     * 多个应用同时初始化同一个 scriptUrl 时会复用同一个 Promise，避免重复插入神策 script 标签。
     */
    const getScriptPromises = () => {
        const root = globalThis;
        if (!root[SCRIPT_PROMISE_SYMBOL])
            root[SCRIPT_PROMISE_SYMBOL] = new Map();
        return root[SCRIPT_PROMISE_SYMBOL];
    };
    /**
     * 从 window 读取神策 SDK 暴露的全局对象。
     * globalName 可配置，默认兼容神策 Web SDK 的 sensorsDataAnalytic201505。
     */
    const getSensors = (globalName) => {
        if (typeof window === 'undefined')
            return undefined;
        return window[globalName];
    };
    /**
     * 按需加载神策 SDK script。
     *
     * 执行顺序：
     * 1. window 已有 SDK 时直接完成，兼容宿主提前加载 script 的场景；
     * 2. 同一 URL 正在加载时复用全局 Promise；
     * 3. DOM 已有同 URL script 时只绑定 load/error，不再创建第二个标签；
     * 4. 否则创建 async script 并追加到 document.head；
     * 5. 加载失败后删除 Promise 缓存，使下一次 bootstrap 可以重试。
     */
    const loadSensorsScript = (scriptUrl, globalName) => {
        if (getSensors(globalName))
            return Promise.resolve();
        if (typeof document === 'undefined')
            return Promise.reject(new Error('Sensors Analytics requires a browser document'));
        const promises = getScriptPromises();
        const existingPromise = promises.get(scriptUrl);
        if (existingPromise)
            return existingPromise;
        const promise = new Promise((resolve, reject) => {
            const existingScript = document.querySelector(`script[src="${scriptUrl}"]`);
            const script = existingScript ?? document.createElement('script');
            /** script load 后再次校验全局对象，避免 CDN 返回了内容但 SDK 没有正确执行。 */
            const handleLoad = () => {
                if (getSensors(globalName))
                    resolve();
                else
                    reject(new Error('Sensors Analytics SDK loaded without exposing its global API'));
            };
            /** 将浏览器 script 网络错误转换成可被 AnalyticsClient.ready 捕获的 Promise rejection。 */
            const handleError = () => reject(new Error('Failed to load Sensors Analytics SDK'));
            script.addEventListener('load', handleLoad, { once: true });
            script.addEventListener('error', handleError, { once: true });
            if (!existingScript) {
                script.async = true;
                script.src = scriptUrl;
                document.head.appendChild(script);
            }
        }).catch((error) => {
            promises.delete(scriptUrl);
            throw error;
        });
        promises.set(scriptUrl, promise);
        return promise;
    };
    /**
     * 补充 iframe 上下文。
     * 同源 iframe 直接读取父页面 URL；跨域访问被浏览器拦截时回退到 document.referrer。
     * 顶层页面或非浏览器环境返回空对象。
     */
    const getIframeContext = () => {
        if (typeof window === 'undefined')
            return {};
        try {
            if (window === window.top)
                return {};
            try {
                return { is_in_iframe: true, parent_url: window.parent.location.href };
            }
            catch {
                return { is_in_iframe: true, parent_url: document.referrer };
            }
        }
        catch {
            return {};
        }
    };
    /**
     * 创建神策版 AnalyticsTransport。
     *
     * 这里是 core 与神策 SDK 的唯一耦合点：core 只调用 initialize/identify/track 等统一接口，
     * 本函数负责把它们映射成 sensors.init/login/track。未来切换其他数据平台时只需实现另一套 Transport。
     */
    const createSensorsTransport = (options = {}) => {
        const globalName = options.globalName ?? 'sensorsDataAnalytic201505';
        const scriptUrl = options.scriptUrl ?? DEFAULT_SENSORS_SCRIPT_URL;
        const isDev = options.isDev ?? false;
        const serverUrl = options.serverUrl
            ?? `${DEFAULT_SENSORS_SERVER_URL}?project=${isDev ? 'default' : 'production'}`;
        /**
         * 获取已加载 SDK；如果调用顺序错误则立即抛错。
         * 该错误会被 AnalyticsClient 捕获并交给 onError，而不会静默丢失事件。
         */
        const requireSensors = () => {
            const sensors = getSensors(globalName);
            if (!sensors)
                throw new Error('Sensors Analytics SDK is not initialized');
            return sensors;
        };
        return {
            /**
             * 加载 script、注册需在 init 前启用的插件、调用 sensors.init，并注册公共页面属性。
             * initialize 不调用 autoTrack/login：它们必须由 core 在身份确认后按正确顺序执行。
             */
            async initialize() {
                await loadSensorsScript(scriptUrl, globalName);
                const sensors = requireSensors();
                (options.plugins ?? ['PageLeave', 'PageLoad', 'SensorsChannel']).forEach((plugin) => {
                    sensors.use?.(plugin);
                });
                sensors.init({
                    server_url: serverUrl,
                    is_track_single_page: true,
                    use_client_time: true,
                    send_type: 'beacon',
                    show_log: isDev,
                    cross_subdomain: false,
                    heatmap: {
                        clickmap: 'default',
                        scroll_notice_map: 'default',
                    },
                    ...options.sdkOptions,
                });
                sensors.registerPage?.({ client_type: 'Web', ...options.pageProperties });
            },
            /**
             * 开启神策全埋点。
             * AnalyticsClient 只会在身份离开 resolving 且已经同步到底层 SDK 后调用一次。
             */
            startAutoTrack() {
                requireSensors().quick?.('autoTrack');
            },
            /** 将 identified 身份映射为 sensors.login，保证后续事件关联到登录用户。 */
            identify(userId) {
                requireSensors().login?.(userId);
            },
            /**
             * 将“已登录 → 匿名”转换为 sensors.logout。
             * 初始 anonymous 不会触发此函数，从而保留 SDK 自动生成的匿名 distinct_id。
             */
            resetIdentity() {
                requireSensors().logout?.();
            },
            /**
             * 发送事件并补充 iframe 上下文与真实发生时间。
             * `$time` 使用入队时 captured occurredAt，而不是出队时间，避免初始化等待扭曲事件时间。
             */
            track(event) {
                requireSensors().track(event.name, {
                    ...getIframeContext(),
                    ...event.properties,
                    $time: event.occurredAt,
                });
            },
            /** 将覆盖式用户属性更新映射到 sensors.setProfile。 */
            setProfile(properties) {
                requireSensors().setProfile?.(properties);
            },
            /** 将仅首次写入的用户属性更新映射到 sensors.setOnceProfile。 */
            setProfileOnce(properties) {
                requireSensors().setOnceProfile?.(properties);
            },
        };
    };

    /**
     * 神策接入方推荐使用的高层初始化函数。
     *
     * 它隐藏内部 Transport 设计：先把 sensors 配置转换成神策 Transport，再交给通用 bootstrap 创建全局单例、
     * 启动异步 SDK 初始化并安装 DOM AOP。函数同步返回 Analytics，初始化期间的 track 会自动排队。
     */
    const bootstrapSensorsAnalytics = (options = {}) => bootstrapAnalytics({
        ...options,
        transport: createSensorsTransport(options.sensors),
    });

    exports.AnalyticsClient = AnalyticsClient;
    exports.DEFAULT_SENSORS_SCRIPT_URL = DEFAULT_SENSORS_SCRIPT_URL;
    exports.DEFAULT_SENSORS_SERVER_URL = DEFAULT_SENSORS_SERVER_URL;
    exports.bootstrapAnalytics = bootstrapAnalytics;
    exports.bootstrapSensorsAnalytics = bootstrapSensorsAnalytics;
    exports.createSensorsTransport = createSensorsTransport;
    exports.getAnalytics = getAnalytics;
    exports.installDomCollector = installDomCollector;
    exports.normalizeIdentity = normalizeIdentity;
    exports.registerAnalyticsProperties = registerAnalyticsProperties;

    Object.defineProperty(exports, '__esModule', { value: true });

}));
