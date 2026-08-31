# 组件迁移登记

## 来源与范围

本批组件按用户指定从以下参考实现直接迁移，不以截图重新设计：

- `C:/Users/wangyiting1/Documents/interndiscovery/platform-static-prototype/design-system/atoms.html`
- `C:/Users/wangyiting1/Documents/interndiscovery/platform-static-prototype/design-system/tokens/Paper_Design_Token.md`
- `C:/Users/wangyiting1/Documents/interndiscovery/platform-static-prototype/shared/css/tokens.css`
- `C:/Users/wangyiting1/Documents/interndiscovery/platform-static-prototype/shared/css/design-system-overrides.css`
- `C:/Users/wangyiting1/Documents/interndiscovery/platform-static-prototype/shared/js/components/research-field-picker.js`（仅使用截图所需的 5 个领域图标）

迁入范围：

- Buttons：32px / 36px、一级 / 二级 / 三级、危险态、禁用态及原使用规则。
- Toast：success、warning、error，顶部单实例，显示 1.8 秒后收起。
- Modal / Dialog：只迁移“创建课题”表单；包含名称输入与计数、领域 radio chips、描述文本域与计数、取消和创建动作。
- Brand Scale：迁移 7 阶 canonical 色值，并用当前 `--accent*` 名称保留兼容关系。
- Semantic & AI Colors：迁移 success / warning / error 四阶、录制红、AI trust 与 AI tint；dark 值由当前项目补全。

未迁入参考页面中的添加到课题、文件选择、删除确认、上传错误等其他 Dialog，也未迁入辅助色板、图表色、侧栏色、无当前消费者的 `--vermilion*` 兼容别名或与本项目无关的兼容选择器。来源展示页与 canonical Token 表冲突的状态 chip 字面量同样未迁入。

## Token 重绑

| 参考实现依赖 | 当前项目绑定 | 说明 |
| --- | --- | --- |
| `--paper` | `--paper` | 纸白表面与反白文字 |
| `--ink` | `--ink` | 一级按钮、Toast 与正文主色 |
| `--ink-soft` | `--ink-soft` | hover 与次级文字 |
| `--bg-soft` | `--bg-soft` | hover、active 与选中底色 |
| `--line` / `--line-soft` | `--line` | 边框与 icon button pressed 背景 |
| `--muted` / `--muted-2` | `--muted` / `--muted-2` | 辅助文字、占位符与弱边框 |
| `--sans` | `--font-sans` | 所有组件正文与表单字体 |
| 参考实现的计数器字体依赖 | `--font-sans` + tabular numerals | 本项目不引入独立等宽字体；计数器仍保持数字对齐 |
| Brand 7 阶 | `--vermilion-1` 至 `--vermilion-7` | Light 值逐项沿用来源 canonical 表 |
| `--accent-soft` / `--accent-2` / `--accent` | `--vermilion-4` / `--vermilion-5` / `--vermilion-6` | 保持当前消费者名称，同时接入完整 Brand Scale |
| Semantic 四阶 | 同名 `--success*` / `--warning*` / `--error*` | 组件不得用来源展示页的非 canonical 字面量替代 |
| `--ai-trust-low: var(--ink-mute)` | `--ai-trust-low: var(--muted)` | 当前库无 `--ink-mute`；两者 Light 值同为 `#7a8394` |
| `--state-danger*` / `--state-success` / `--state-warning` / `--state-error` | `--error*` / `--success-soft` / `--warning-soft` / `--error-soft` | 保留现有组件接口；Toast 使用 soft 阶兼顾亮暗承载面的对比度 |
| 4px / 8px / pill 圆角 | `--radius` / `--radius-card` / `--radius-pill` | pill 为组件代码 Token，非 Figma Variable |

## 公共接口与状态

- 公共样式：`../shared/css/design-system-overrides.css`
- 公共交互：`../shared/js/components.js`
- 核对页面：`components.html`
- 浏览器全局接口：`window.InternInkStoneUI.openDialog()`、`closeDialog()`、`showToast()`
- 创建成功事件：`interninkstone:topic-created`

当前已登记消费者为 Home、shell 与 Design System；本轮只在 Design System 核对页启用 dark mode，未把主题切换能力扩展到正式产品页。

## Dark mode 应用

- `components.html` 与 `index.html` 共同加载 `design-system.css` 和 `theme.js`，因此 Buttons、创建课题 Dialog 与 Toast 会消费原子规范中同名颜色和组件状态色的当前 mode 值。
- Dark mode 覆盖现有基础颜色和本轮明确迁入的 Brand / Semantic / AI 颜色；尺寸、圆角、字体、动效及组件接口保持不变，也未新增组件私有颜色变量。
- `--component-overlay-bg`、`--component-dialog-shadow` 与 `--component-toast-shadow` 是已有组件变量。Dark mode 只重算其暗色表现，避免由浅色前景变量派生出发亮的遮罩或阴影。
- Brand 通过 `--accent*` 服务 Checkbox 选中态；Semantic 通过 `--state-*` 服务危险按钮和三类 Toast；AI tint 继续服务选中信息面。
- Dark Toast 使用 `--bg-soft-1` 暗色表面、`--ink` 亮色文字和 `--line` 边界；success / warning / error 图标在该表面上的对比度分别为 4.97:1、5.05:1、5.19:1，浅色 Toast 对比度分别为 6.66:1、7.09:1、5.33:1。
- 接近上限的 10.5px 计数文字使用现有 `--warning-deep`，避免以默认 warning 阶作为小号正文色；未新增变量。

## Figma 新增按钮

以下两个按钮是后续按当前项目 Figma 设计补充的公共候选组件，不属于上文的参考项目迁移范围：

| 组件接口 | 设计证据 | 当前实现 |
| --- | --- | --- |
| `.btn-text` | `242:63219` 默认、`242:63221` hover | 84px 参考内容宽度、36px 高、Padding X 12px、Radius 8px、15px / 24px；背景 `--bg` -> `--bg-soft`，文字 `--ink-soft` |
| `.btn-link` | 用户给出的 `242:63225`、`242:63226` 当前已不在 Figma 文件节点清单中 | 采用用户明确的默认无下划线、hover 下划线从左向右出现规则；字体暂复用同组 `.btn-text` 基线，文字与下划线使用 `--ink` |

两类按钮在可交互状态都使用 `cursor: pointer`；文字链接按钮同时在 `:focus-visible` 展示完整下划线，并在 `prefers-reduced-motion: reduce` 下取消可见的过渡时长。
