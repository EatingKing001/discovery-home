(function () {
  "use strict";

  const LABEL_TO_KEY = Object.freeze({
    "平台服务协议": "service",
    "个人信息保护政策": "privacy"
  });

  function protocolHref(key) {
    const protocols = window.SiteLinkConfig?.protocols || {};
    return String(protocols[key] || "").trim();
  }

  function upgradePolicyNode(node) {
    const label = (node.textContent || "").trim();
    const key = LABEL_TO_KEY[label];
    if (!key) return;
    const href = protocolHref(key);
    if (!href) {
      console.info(`[discovery-home] 协议链接未配置：${label}`);
      return;
    }

    if (node.tagName === "A") {
      node.href = href;
      node.target = "_blank";
      node.rel = "noopener noreferrer";
      return;
    }

    const anchor = document.createElement("a");
    anchor.className = node.className;
    anchor.href = href;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.textContent = label;
    node.replaceWith(anchor);
  }

  function init() {
    document.querySelectorAll(".footer-policy-link").forEach(upgradePolicyNode);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
