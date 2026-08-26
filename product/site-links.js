(function () {
  "use strict";

  /**
   * 正式仓业务配置（位于 product/，同步设计稿时禁止覆盖本目录）。
   * 空字符串表示尚未配置；业务脚本会走 console / 友好 toast，不会假成功。
   */
  window.SiteLinkConfig = Object.freeze({
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
