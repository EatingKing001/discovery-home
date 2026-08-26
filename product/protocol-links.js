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

  function openProtocol(href) {
    window.open(href, "_blank", "noopener,noreferrer");
  }

  function bindSpanAsLink(node, href) {
    if (node.dataset.protocolBound === "1") return;
    node.dataset.protocolBound = "1";
    node.setAttribute("role", "link");
    node.tabIndex = 0;

    node.addEventListener("click", function () {
      openProtocol(href);
    });

    node.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        if (event.key === " ") event.preventDefault();
        openProtocol(href);
      }
    });
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

    bindSpanAsLink(node, href);
  }

  function init() {
    document.querySelectorAll(".footer-policy-link").forEach(upgradePolicyNode);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
