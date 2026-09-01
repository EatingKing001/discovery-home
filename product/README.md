# product/ — 正式仓业务薄层

本目录由正式仓维护，**设计同步不会覆盖**。

## 同步设计稿

在仓库根目录执行：

```powershell
.\product\sync-from-design.ps1
# 或指定设计仓路径：
.\product\sync-from-design.ps1 -Source "C:\path\to\inkstone-website"
```

脚本会 robocopy 覆盖 `tabs/home`、`shared`、`design-system`，复制 `index.html`，并自动向 HTML 注入下方 script / stylesheet，以及埋点 `data-analytics-*` 属性。`product/`、`docs/`、根 `README.md` 不会被覆盖。

## Script / CSS 列表

| 文件 | 用途 |
|------|------|
| `vendor/migo-analytics.bundle.js` | 已发布 `@migo/analytics` UMD（提交进仓，Docker 无需 npm） |
| `analytics-bootstrap.js` | 神策初始化 + 身份匿名 + 网页版双事件；iframe 内关闭 auto `$pageview` |
| `site-links.js` | `SiteLinkConfig`（`basePath` / 外链 / 下载频道 / 协议 / 合作 API） |
| `base-path.js` | 子路径挂载：无尾斜杠跳转、`<base>`、Home iframe 绝对 `src`（壳 `index.html`） |
| `cooperation-submit.js` | 合作表单提交 |
| `downloads.js` | Mac 下载：按频道拉 OSS `release-manifest` 取 dmg；下载真正开始时 `download_click` |
| `protocol-links.js` | Footer 协议外链 |
| `cooperation-cta-hide.css` | 无 `cooperationSubmitUrl` 时隐藏 logo 墙下申请合作 CTA；有接口后删除本文件及 HTML 注入即可 |
| `sync-from-design.ps1` | 设计同步 + HTML 注入 |

## 埋点（@migo/analytics）

**建议值已采用，请产品确认**

| 字段 | 值 | 依据 |
|------|-----|------|
| `app_id` | `discovery-home-new-fe` | CI `SERVICE_NAME` |
| `biz` | `science-discovery` | `discovery-host-fe` SensorsBuried |
| `client_type` | `Web` | 浏览器静态站 |

- **PV/UV**：壳页（及独立打开的 Home）初始化后神策 `quick('autoTrack')` → `$pageview`；UV 由神策侧按匿名 `distinct_id` 统计。官网无登录，bootstrap 后 `setIdentity({ resolving: false, userId: null })`。
- **iframe 策略**：`?embedded=1` 或 `parent!==self` 时仍初始化 DOM 点击采集，但 `startAutoTrack` 置空，避免与壳页重复 `$pageview`。独立打开 `/tabs/home/` 走完整 autoTrack。
- **事件**：`online_use_click`（`entry`: `header` \| `banner` \| `downloads_web`）；`download_click`（`version`: `web` \| `mac_intel` \| `mac_arm`；Mac 另带 `package_version` 来自 release-manifest）。网页版卡片一次点击同时打两个事件（collector 单节点只能绑一个 event，故用 bootstrap 内监听；无 `package_version`）。
- **isDev**：hostname ≠ `discovery-home.intern-ai.org.cn` 时为 `true`（上报神策测试项目 `default`）。

更新 vendor 包（需内网 registry）：

```bash
npm install
npm run vendor:analytics
```

## 子路径 `basePath`

`SiteLinkConfig.basePath`（无尾斜杠）须与 `values/*.yml` 的 `ingress.path` 对齐。三环境均为 `/home`。

| 场景 | 做法 |
|------|------|
| 本地 `http-server` 根路径预览 | 临时把 `basePath` 改为 `""` |
| 部署在 `/home` | `basePath: "/home"`（与 values path 一致） |

## 钩子变更时

若设计侧改名以下钩子，需同步改本目录业务脚本（不要改设计仓逻辑硬塞进业务）：

- `[data-cooperation-form]` / `[data-local-cooperation-form]`
- `.footer-policy-link` 与文案「平台服务协议」「个人信息保护政策」
- `article.download-card` + `Intel x64` / `ARM64` / `.is-coming`
- Toast：`#shell-toast`、`#home-local-cooperation-toast`
- 埋点：`.site-header-action`、`.hero-action`、`a.download-card[data-discovery-link]`
