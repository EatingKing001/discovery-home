# discovery-home-fe

书生·端砚官网前端（静态站点）：shell + iframe Home。视觉来自设计仓 `inkstone-website`，业务能力放在根目录 `product/`，便于反复同步设计而不冲掉产品逻辑。

## 本地预览

在仓库根目录：

```powershell
npx http-server -p 8023 -c-1
```

也可用 `python -m http.server 8023`。请勿用默认开启 `cleanUrls` 的 `serve`。

- 平台入口：http://127.0.0.1:8023/
- Home 独立页：http://127.0.0.1:8023/tabs/home/
- Design System（可选）：http://127.0.0.1:8023/design-system/

请勿用 `file://` 打开（跨 iframe / 字体等行为会异常）。

## 目录要点

```text
discovery-home-fe/
├── index.html                 # shell 入口
├── product/                   # 正式仓业务（禁止被设计同步覆盖）
│   ├── site-links.js          # SiteLinkConfig（含 basePath）
│   ├── base-path.js           # 子路径跳转 / <base> / iframe 绝对 src
│   ├── cooperation-submit.js
│   ├── downloads.js
│   ├── protocol-links.js
│   ├── sync-from-design.ps1   # 从设计仓同步 + 注入 script
│   └── README.md
├── docs/DESIGN_SYNC.md        # 设计同步约定（必读）
├── shared/                    # 设计样式 / 资源 / shell.js（可覆盖）
└── tabs/home/                 # Home 视觉与展示数据（可覆盖）
```

配置位见 `product/site-links.js`（`basePath` 与 values path 对齐；下载 URL、合作提交 API 可先留空）。从设计仓同步：

```powershell
.\product\sync-from-design.ps1
```

神策埋点见 [product/README.md](product/README.md)「埋点」：壳页负责 `$pageview`；Home iframe 只报点击（关闭 autoTrack）；vendor 包已提交 `product/vendor/migo-analytics.bundle.js`。

步骤与检查清单见 [docs/DESIGN_SYNC.md](docs/DESIGN_SYNC.md)、[product/README.md](product/README.md)。
