# 部署：三环境 × 三分支

推断自同组仓（`discovery-host-fe` README / 分支、`discovery-dataset-fe` values 域名）及本仓 `env/`、`deploy/nginx/templates/env.conf.template`。本地不可读 `devops/ci-templates`，dev/staging job 细节以模板为准。

## 分支 ↔ values ↔ 域名

```
develop              → values/dev.yml     → discovery-home-dev.intern-ai.org.cn/home
release              → values/release.yml → discovery-home-staging.intern-ai.org.cn/home
main-new / tag_prod_* → values/prod.yml   → discovery-home.intern-ai.org.cn/home
```

生产 CI（本文件显式 job）仅触发：`main-new`、`/^tag_prod_aliyun_[0-9].*$/`。

## CI 变量（本仓 variables）

| 变量 | 值 |
|------|-----|
| `DEV_SGPU_VALUE_FILE` | `values/dev.yml` |
| `PROD_VALUE_FILE` | `values/prod.yml` |

预发 value 文件路径：同组本地 CI **未**显式声明 staging 变量名，一般由 `include: /templates/aliyun-aigc.yml` 默认指向 `values/release.yml`。若流水线报缺变量，对照模板补上同名变量即可。

## 说明

- 三环境均使用 `path: /home`；容器内 nginx（`deploy/nginx/conf.d/default.conf`）负责剥 `/home` 前缀访问静态根，Ingress 无需 rewrite。
- 本服务使用独立的 `discovery-home-*` 域名，与 host/dataset 平台域名分离。
