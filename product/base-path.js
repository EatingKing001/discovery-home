(function () {
  "use strict";

  var config = window.SiteLinkConfig || {};
  var basePath = typeof config.basePath === "string" ? config.basePath : "/home1";

  if (!basePath) {
    return;
  }

  if (basePath.length > 1 && basePath.charAt(basePath.length - 1) === "/") {
    basePath = basePath.slice(0, -1);
  }

  var baseHref = basePath + "/";

  if (location.pathname === basePath) {
    location.replace(baseHref + location.search + location.hash);
    return;
  }

  ensureBase(baseHref);

  function ensureBase(href) {
    var existing = document.querySelector("base");
    if (existing) {
      if (existing.getAttribute("href") !== href) {
        existing.setAttribute("href", href);
      }
      return;
    }
    var head = document.head || document.getElementsByTagName("head")[0];
    if (!head) return;
    var base = document.createElement("base");
    base.setAttribute("href", href);
    head.insertBefore(base, head.firstChild);
  }

  function resolveFrameSrc(currentSrc) {
    var v = "";
    var qIndex = currentSrc.indexOf("?");
    if (qIndex >= 0) {
      try {
        v = new URLSearchParams(currentSrc.slice(qIndex + 1)).get("v") || "";
      } catch (e) {
        /* ignore */
      }
    }
    var next = basePath + "/tabs/home/index.html?embedded=1";
    if (v) {
      next += "&v=" + encodeURIComponent(v);
    }
    return next;
  }

  function fixHomeFrame() {
    var frame =
      document.querySelector("[data-home-frame]") ||
      document.querySelector("iframe.site-frame");
    if (!frame) return;

    var current = frame.getAttribute("src") || "";
    var prefix = basePath + "/";
    if (current.indexOf(prefix) === 0) {
      return;
    }

    frame.src = resolveFrameSrc(current);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fixHomeFrame);
  } else {
    fixHomeFrame();
  }
})();
