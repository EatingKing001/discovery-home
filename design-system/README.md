# Design System 核对区

本目录用于展示和核对已经稳定的公共 Token、组件与状态，不承载产品业务逻辑，也不自动加入平台主导航。

- `index.html`：原子规范入口，展示颜色、圆角、字体、Text Style、适配 Token 和三档适配原则。
- `components.html`：组件规范入口，展示并实际运行 Buttons、指定的“创建课题”Dialog 和三类 Toast。
- `design-system.css`：仅供本目录页面使用的展示样式。
- `../shared/js/theme.js`：正式页面与 Design System 共用的亮暗色初始化、切换、偏好持久化和主题图片切换。
- `COMPONENT_MIGRATION.md`：组件来源、迁入范围、Token 重绑和公共接口登记。
- 公共产品规则位于 `../shared/css/`，不能为了展示方便复制到本目录。
- 公共组件交互位于 `../shared/js/components.js`；规范页只提供示例 DOM，不复制实现逻辑。
- Figma Variable 与 Style 只有在当前文件的实际节点或导出数据可以追溯时，才进入代码和本页。
- 从产品模块提炼的公共组件仍需两个以上真实消费者；当前公共组件已登记并由 Home、shell 与 Design System 消费。亮暗色主题已作为正式公共能力由这三个消费者共同使用。

## Brand / Semantic 迁移结论

1. Light mode 的事实来源是参考项目的 `design-system/tokens/Paper_Design_Token.md`；`atoms.html` 负责展示。来源明确是 Light Warm 单主题，没有可直接迁移的 dark mode。
2. Brand Scale 迁入 7 个 canonical `--vermilion-1` 至 `--vermilion-7`；当前库已有的 `--accent-soft` / `--accent` 改为 L4 / L6 别名，并补齐来源展示中的 `--accent-2`（L5）。
3. Semantic & AI Colors 迁入 success、warning、error 各四阶，以及 `--rec-red`、3 个 AI trust 别名和 2 个 AI tint 参数。来源展示页中与 canonical 表不一致的状态 chip 字面量没有迁入。
4. 去重优先：`--ai-trust-low` 绑定当前库等价的 `--muted`；没有为了兼容来源而新增 `--ink-mute`。来源额外的 `--vermilion*` 兼容别名也没有加入，因为当前库没有消费者，原子页迁移不依赖它们。
5. 本轮新增的变量名只来自用户指定的两个区块；辅助色板、图表色、侧栏色和其他来源参数均未迁入。

## Dark mode 推导结论

1. Dark mode 保持 light mode 的语义角色，不做 RGB 反相：`--paper` / `--bg*` 继续负责表面层级，`--ink*` / `--muted*` 继续负责文字层级。
2. Brand Scale 按用途重排明度：L1–L3 仍是暗色 tint / disabled / fill，L4 保证必要边线可辨，L5–L7 继续承担 hover / default / pressed；因此 dark 值不要求与 light HEX 等距。
3. Semantic 四阶按承载面处理：`*-bg` 是暗色染色表面，default / soft / deep 是可用于文字、图标或强调边界的前景；success 与 error 仍必须附图标或文字，不能只靠色相区分。
4. 普通文本按 WCAG AA 的 4.5:1 校验，必要 UI 边界按 3:1 校验。按当前指定值实测：`--ink` / `--bg` 14.24:1、`--ink-soft` / `--bg` 8.31:1、`--vermilion-6` / `--paper` 8.58:1、`--vermilion-4` / `--paper` 3.77:1、三个 `--state-*` 前景 / `--bg-soft-1` 分别为 5.24:1、5.32:1、5.46:1，`--ai-tint-rule` / `--paper` 3.07:1，`--rec-red` / `--paper` 7.64:1。`--line` / `--paper` 为 1.48:1，`--muted-2` / `--bg` 为 2.39:1，因此二者只用于装饰分隔或禁用弱信息，不承担必要控件边界或普通正文。
5. 组件不新增颜色私有变量：现有 `--accent*` 和 `--state-*` 作为兼容别名消费新色阶；三类 Toast 状态别名绑定 semantic soft 阶，以同时满足浅色 Toast 与 Dark Toast 的对比度。Dark Toast 改用暗色表面和亮色文字。
6. 首次访问跟随 `prefers-color-scheme`，用户通过页面开关选择后以本地偏好优先；两个规范页共享选择。开关使用原生按钮与 `role="switch"` / `aria-checked` 暴露状态。

参考依据：

- [Android Themes](https://developer.android.com/design/ui/mobile/guides/styles/themes)：dark surfaces 采用低明度灰阶，建议跟随系统偏好并提供应用内控制。
- [WCAG 2.2 Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) 与 [Non-text Contrast](https://www.w3.org/WAI/WCAG22/understanding/non-text-contrast.html)：正文 4.5:1、必要 UI 边界 3:1。
- [MDN color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme) 与 [prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme)：声明浏览器配色并读取系统偏好。
- [WAI-ARIA Switch Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/switch/)：二态开关暴露可访问状态。

## Dark mode 参数

### 基础颜色

| 现有变量 | Light | Dark | 角色 |
| --- | --- | --- | --- |
| `--paper` | `#ffffff` | `#1a1815` | 主表面与反转前景 |
| `--bg` | `#fdfcf8` | `#1a1815` | 最低明度背景 |
| `--ink` | `#1a2332` | `#ebe6dc` | 主文字与反转表面 |
| `--ink-soft` | `#3a4556` | `#b8b1a3` | 次级文字与 hover 主色 |
| `--bg-soft` | `#f7f4ec` | `#252320` | hover / active 表面 |
| `--bg-soft-1` | `#faf8f2` | `#1f1d1a` | 卡片与容器表面 |
| `--line` | `#e8e4d9` | `#3a3631` | 低强调装饰分隔 |
| `--muted` | `#7a8394` | `#8a8478` | 辅助文字 |
| `--muted-2` | `#a9b0bd` | `#5a554c` | 禁用或极弱信息 |

### Brand Scale

| Token | Light | Dark | 角色 |
| --- | --- | --- | --- |
| `--vermilion-1` | `#f4f7fb` | `#151f2c` | 极弱 tint |
| `--vermilion-2` | `#dde7f4` | `#1b2d43` | disabled / 弱底 |
| `--vermilion-3` | `#b8ceea` | `#294665` | 小面积填充 |
| `--vermilion-4` | `#88addd` | `#4f779f` | 边线 / 引导 |
| `--vermilion-5` | `#3f7dcf` | `#aacaf0` | hover 强调 |
| `--vermilion-6` | `#1554a8` | `#8db8e9` | 常规品牌强调 |
| `--vermilion-7` | `#0c3c80` | `#6f9bd2` | pressed |

### Semantic & AI Colors

| Token | Light | Dark | 角色 |
| --- | --- | --- | --- |
| `--success` | `#6b7a3a` | `#b7c87d` | 成功前景 / 高置信 |
| `--success-soft` | `#a4ad7e` | `#87965b` | 成功弱前景 / 边线 |
| `--success-bg` | `#f1f3e8` | `#242a1c` | 成功染色表面 |
| `--success-deep` | `#4d5826` | `#d2df9b` | 成功强强调 |
| `--warning` | `#a8864b` | `#e8c27a` | 警告前景 / 中置信 |
| `--warning-soft` | `#cba87b` | `#b28a4f` | 警告弱前景 / 边线 |
| `--warning-bg` | `#f8f1e3` | `#33291a` | 警告染色表面 |
| `--warning-deep` | `#7a5e2c` | `#f4d18a` | 警告强强调 |
| `--error` | `#c03030` | `#ffb4ab` | 错误 / 破坏性前景 |
| `--error-soft` | `#df7878` | `#d37a78` | 错误弱前景 / 边线 |
| `--error-bg` | `#fdeaea` | `#3b2021` | 错误染色表面 |
| `--error-deep` | `#9a2020` | `#ff8a80` | 错误强强调 |
| `--rec-red` | `#e74c3c` | `#ff887a` | 仅 live / recording |
| `--ai-trust-high` | `var(--success)` | `var(--success)` | 高置信别名 |
| `--ai-trust-mid` | `var(--warning)` | `var(--warning)` | 中置信别名 |
| `--ai-trust-low` | `var(--muted)` | `var(--muted)` | 低置信别名 |
| `--ai-tint` | `#f5f8fc` | `#172333` | AI 消息底 |
| `--ai-tint-rule` | `#d8e4f3` | `#496985` | AI 消息边线 |

### 组件兼容别名

| 现有组件变量 | 当前绑定 |
| --- | --- |
| `--state-danger` | `var(--error)` |
| `--state-danger-strong` | `var(--error-deep)` |
| `--state-success` | `var(--success-soft)` |
| `--state-warning` | `var(--warning-soft)` |
| `--state-error` | `var(--error-soft)` |

Light 与 Dark 参数统一定义在 `../shared/css/tokens.css`；Dark 使用 `:root[data-theme="dark"]` 覆盖同名语义变量。`../shared/js/theme.js` 负责初始化、切换、持久化和同步 `aria-checked` / `aria-pressed`，不承载产品业务逻辑。模块未进入 Design System 的代码化色值应先定义模块语义变量，再为 Dark 补全对应值，不能在选择器内散落暗色字面量。

主题图片预留接口为 `data-theme-src-light` / `data-theme-src-dark` 与 `data-theme-srcset-light` / `data-theme-srcset-dark`。Dark 资源缺失时运行时自动回退 Light 资源；因此当前可以沿用亮色图片，后续只需补充 Dark 属性，不需要改主题交互代码。
