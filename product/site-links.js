(function () {
  "use strict";

  /**
   * 正式仓业务配置（位于 product/，同步设计稿时禁止覆盖本目录）。
   * 空字符串表示尚未配置；业务脚本会走 console / 友好 toast，不会假成功。
   *
   * basePath：站点挂载子路径（无尾斜杠），须与 values/*.yml 的 ingress path 对齐（现为 /home）。
   * - 本地 http-server 根路径预览：临时改为 ""
   */
  window.SiteLinkConfig = Object.freeze({
    basePath: "/home",
    discoveryWebApp: "https://discovery.intern-ai.org.cn/",
    downloads: Object.freeze({
      macIntel: "",
      macArm: ""
    }),
    protocols: Object.freeze({
      service: "https://sso.openxlab.org.cn/protocol/service",
      privacy: "https://sso.openxlab.org.cn/protocol/privacy"
    }),
    cooperationSubmitUrl: ""
  });
})();
