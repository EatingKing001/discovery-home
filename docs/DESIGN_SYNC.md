# 设计稿同步约定（设计可覆盖 / 业务不覆盖）

本仓视觉来自 `inkstone-website`。同步时整包覆盖设计侧文件；正式仓业务一律放在根目录 `product/`，**禁止**被设计同步覆盖。

## 可被设计稿覆盖

| 路径 | 说明 |
|------|------|
| `tabs/home/index.html` | Home 结构 / 视觉（同步脚本会自动补回 product script） |
| `tabs/home/home.css` | Home 样式 |
| `tabs/home/home.js` | 纯视觉交互（锚点、弹窗打开、marquee 等） |
| `tabs/home/assets/` | Home 私有资源 |
| `tabs/home/data/` | 展示用静态数据 |
| `shared/css/` | token / base / shell 等设计样式 |
| `shared/assets/` | logo、字体、图片等 |
| `shared/js/` | 设计侧 JS（含可能带回的设计版 `site-links.js`；正式仓**不引用**） |
| `design-system/` | 规范核对页（若保留） |
| `index.html` | shell 入口（同步脚本会自动补回 product script） |

## 禁止覆盖（只在正式仓维护）

| 路径 | 说明 |
|------|------|
| `product/` | 业务配置 + 薄层 + 同步脚本（整目录） |
| `docs/` | 含本文档 |
| `README.md` | 正式仓项目说明 |
| 任意 `.env*` / 本地密钥 | 永不提交、不同步 |

### `product/` 业务文件

- `product/site-links.js` — 外链、下载频道/`releaseBase`、协议、合作提交 API、`basePath`（`SiteLinkConfig`；须与 `values/*.yml` ingress path 对齐，现为 `/home`）
- `product/base-path.js` — 子路径：无尾斜杠跳转、`<base>`、壳 iframe 绝对 `src`（仅壳 `index.html`）
- `product/cooperation-submit.js` — 合作表单可插拔提交
- `product/downloads.js` — Mac 下载（OSS release-manifest → dmg）+ 移动端 toast
- `product/protocol-links.js` — Footer 协议外链注入
- `product/cooperation-cta-hide.css` — 无 `cooperationSubmitUrl` 时隐藏申请合作 CTA；有接口后删除 CSS 与注入即可
- `product/sync-from-design.ps1` — 设计同步 + HTML 注入

说明：设计仓同步可能把设计版 `shared/js/site-links.js` 带回；正式 HTML **只引用** `product/site-links.js`，忽略设计版即可。本地根路径预览可将 `basePath` 临时设为 `""`。

## 正式仓应保留的 script 标签

同步后由 `product/sync-from-design.ps1` 自动注入（幂等）。人工核对时确认：

**`index.html`（shell）：**

```html
<script src="product/site-links.js?v=…" defer></script>
<script src="product/base-path.js?v=…" defer></script>
<script src="shared/js/shell.js?v=…" defer></script>
<script src="product/cooperation-submit.js?v=…" defer></script>
```

**`tabs/home/index.html`：**

```html
<link rel="stylesheet" href="home.css?v=…">
<link rel="stylesheet" href="../../product/cooperation-cta-hide.css?v=…">
<script src="../../product/site-links.js?v=…" defer></script>
<!-- data/*.js + home.js 保持设计侧顺序 -->
<script src="home.js?v=…" defer></script>
<script src="../../product/protocol-links.js?v=…" defer></script>
<script src="../../product/downloads.js?v=…" defer></script>
<script src="../../product/cooperation-submit.js?v=…" defer></script>
```

## 从 inkstone-website 同步（推荐）

在仓库根目录执行：

```powershell
.\product\sync-from-design.ps1
# 可选：-Source "C:\path\to\inkstone-website"
```

脚本行为：

1. robocopy 覆盖 `tabs\home`、`shared`、`design-system`
2. Copy-Item 覆盖根 `index.html`
3. **不**覆盖 `product/`、`docs/`、根 `README.md`
4. 向 `index.html` / `tabs/home/index.html` 注入 product script / stylesheet；移除旧的 `shared/js/site-links.js`、`shared/js/business/*` 引用

预览：

```powershell
npx http-server -p 8023 -c-1
```

请勿用默认开启 `cleanUrls` 的 `serve`。

## 同步后检查清单

1. **业务 script 是否仍指向 `product/`**，且位于设计 `shell.js` / `home.js` 的合理位置（site-links → base-path → shell，业务薄层在后）。
2. **钩子是否改名**：`[data-cooperation-form]`、`[data-local-cooperation-form]`、`.footer-policy-link`、文案「平台服务协议」「个人信息保护政策」、Mac 卡 `article.download-card` 及副标题 `Intel x64` / `ARM64`、`.is-coming`。钩子变了就改 `product/`，不要改设计仓逻辑硬塞业务。
3. **Toast 容器是否还在**：`#shell-toast`、`#home-local-cooperation-toast`。
4. **`product/site-links.js` 是否仍为正式仓配置**（含 `basePath` / `downloads.releaseBase` / `downloadChannel` / `protocols` / `cooperationSubmitUrl`）；`basePath` 与部署 path 一致，壳是否仍引用 `product/base-path.js`。
5. 本地起静态服务，抽测：Footer 协议新开页、Mac 卡点击（桌面走 staging manifest→dmg / 窄屏 toast「请使用电脑下载」）、合作表单未配置时 toast「提交通道未配置」且 console 有 payload。
