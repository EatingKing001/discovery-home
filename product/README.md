# product/ — 正式仓业务薄层

本目录由正式仓维护，**设计同步不会覆盖**。

## 同步设计稿

在仓库根目录执行：

```powershell
.\product\sync-from-design.ps1
# 或指定设计仓路径：
.\product\sync-from-design.ps1 -Source "C:\path\to\inkstone-website"
```

脚本会 robocopy 覆盖 `tabs/home`、`shared`、`design-system`，复制 `index.html`，并自动向 HTML 注入下方 script / stylesheet。`product/`、`docs/`、根 `README.md` 不会被覆盖。

## Script / CSS 列表

| 文件 | 用途 |
|------|------|
| `site-links.js` | `SiteLinkConfig`（外链 / 下载 / 协议 / 合作 API） |
| `cooperation-submit.js` | 合作表单提交 |
| `downloads.js` | Mac 下载 + 移动端 toast |
| `protocol-links.js` | Footer 协议外链 |
| `cooperation-cta-hide.css` | 无 `cooperationSubmitUrl` 时隐藏 logo 墙下申请合作 CTA；有接口后删除本文件及 HTML 注入即可 |
| `sync-from-design.ps1` | 设计同步 + HTML 注入 |

## 钩子变更时

若设计侧改名以下钩子，需同步改本目录业务脚本（不要改设计仓逻辑硬塞进业务）：

- `[data-cooperation-form]` / `[data-local-cooperation-form]`
- `.footer-policy-link` 与文案「平台服务协议」「个人信息保护政策」
- `article.download-card` + `Intel x64` / `ARM64` / `.is-coming`
- Toast：`#shell-toast`、`#home-local-cooperation-toast`
