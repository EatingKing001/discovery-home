(function () {
  "use strict";

  /**
   * 正式仓业务配置（位于 product/，同步设计稿时禁止覆盖本目录）。
   * 空字符串表示尚未配置；业务脚本会走 console / 友好 toast，不会假成功。
   *
   * basePath：站点挂载子路径（无尾斜杠），须与 values/*.yml 的 ingress path 对齐（现为 /home）。
   * - 本地 http-server 根路径预览：临时改为 ""
   *
   * discoveryWebApp：产品站 /chat 入口，按 hostname 自动推断（与 downloadChannel 一致）
   *   · discovery-home.intern-ai.org.cn → https://discovery.intern-ai.org.cn/chat
   *   · discovery-home-staging… / discovery-home-dev… / 本地 → https://discovery-staging.intern-ai.org.cn/chat
   *
   * downloads：Mac 安装包不写死 dmg 直链，由 downloads.js 按频道拉 OSS release-manifest 再拼 dmg。
   * - releaseBase：inkstone releases 根
   * - downloadChannel：可选覆盖 "prod" | "staging"；空则按 hostname 自动推断
   *   · discovery-home.intern-ai.org.cn → prod
   *   · discovery-home-staging… / discovery-home-dev… / 本地 → staging
   *   （dev 与 staging 共用 staging 频道 manifest，与「dev 链接把 prod 换成 staging」一致）
   */
  function resolveDiscoveryWebApp() {
    var host = String(location.hostname || "").toLowerCase();
    var base = host === "discovery-home.intern-ai.org.cn"
      ? "https://discovery.intern-ai.org.cn"
      : "https://discovery-staging.intern-ai.org.cn";
    return base + "/chat";
  }

  window.SiteLinkConfig = Object.freeze({
    basePath: "/home",
    discoveryWebApp: resolveDiscoveryWebApp(),
    downloads: Object.freeze({
      releaseBase: "https://openxlab.oss-cn-shanghai.aliyuncs.com/releases/inkstone/",
      downloadChannel: ""
    }),
    protocols: Object.freeze({
      service: "https://sso.openxlab.org.cn/protocol/service",
      privacy: "https://sso.openxlab.org.cn/protocol/privacy"
    }),
    cooperationSubmitUrl: ""
  });
})();
