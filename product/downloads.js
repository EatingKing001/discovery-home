(function () {
  "use strict";

  const toastIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v6"></path><circle cx="12" cy="16" r="1" fill="currentColor" stroke="none"></circle></svg>';
  let toastTimer = 0;

  /** @type {Record<string, Promise<string>>} */
  const dmgUrlByKey = Object.create(null);

  function showToast(message) {
    const toast = document.getElementById("home-local-cooperation-toast") || document.getElementById("shell-toast");
    if (!toast) {
      window.alert(String(message || ""));
      return;
    }
    toast.className = "app-toast warning";
    toast.setAttribute("role", "status");
    toast.innerHTML = `<span class="app-toast-ico">${toastIcon}</span><span class="app-toast-msg"></span>`;
    toast.querySelector(".app-toast-msg").textContent = String(message || "");
    window.clearTimeout(toastTimer);
    window.requestAnimationFrame(() => toast.classList.add("show"));
    toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function isMobileClient() {
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) return true;
    if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) return true;
    return window.matchMedia("(max-width: 767px)").matches;
  }

  function joinUrl(base, path) {
    const b = String(base || "").replace(/\/+$/, "");
    const p = String(path || "").replace(/^\/+/, "");
    if (!b || !p) return "";
    return b + "/" + p;
  }

  function archFolder(key) {
    if (key === "mac-intel") return "mac_x64";
    if (key === "mac-arm") return "mac_arm";
    return "";
  }

  /**
   * prod 仅精确匹配正式域名；staging / dev / 本地一律走 staging 频道。
   * 可选 SiteLinkConfig.downloads.downloadChannel 覆盖。
   */
  function resolveDownloadChannel() {
    const override = String(window.SiteLinkConfig?.downloads?.downloadChannel || "").trim();
    if (override === "prod" || override === "staging") return override;

    const host = String(location.hostname || "").toLowerCase();
    if (host === "discovery-home.intern-ai.org.cn") return "prod";
    return "staging";
  }

  function releaseBase() {
    const configured = String(window.SiteLinkConfig?.downloads?.releaseBase || "").trim();
    return configured || "https://openxlab.oss-cn-shanghai.aliyuncs.com/releases/inkstone/";
  }

  function manifestUrlFor(key) {
    const folder = archFolder(key);
    if (!folder) return "";
    return joinUrl(releaseBase(), folder + "/" + resolveDownloadChannel() + "/release-manifest.json");
  }

  function dmgUrlFromManifest(manifest) {
    const downloads = Array.isArray(manifest?.downloads) ? manifest.downloads : [];
    const dmg = downloads.find((item) => item && String(item.format || "").toLowerCase() === "dmg");
    const path = dmg ? String(dmg.path || "").trim() : "";
    return path ? joinUrl(releaseBase(), path) : "";
  }

  function loadDmgUrl(key) {
    const manifestUrl = manifestUrlFor(key);
    if (!manifestUrl) return Promise.resolve("");

    return fetch(manifestUrl, { credentials: "omit", cache: "no-cache" })
      .then((res) => {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then((manifest) => {
        const url = dmgUrlFromManifest(manifest);
        if (!url) {
          console.info(`[discovery-home] release-manifest 无 dmg：${key}`, manifestUrl);
        }
        return url;
      })
      .catch((err) => {
        console.info(`[discovery-home] 拉取 release-manifest 失败：${key}`, manifestUrl, err);
        return "";
      });
  }

  /** 同 key 共用 in-flight；成功结果缓存，失败可重试。 */
  function resolveDmgUrl(key) {
    if (!dmgUrlByKey[key]) {
      dmgUrlByKey[key] = loadDmgUrl(key).then((url) => {
        if (!url) delete dmgUrlByKey[key];
        return url;
      });
    }
    return dmgUrlByKey[key];
  }

  function resolveMacCards() {
    const cards = Array.from(document.querySelectorAll("article.download-card.is-hoverable:not(.is-coming)"));
    const intel = cards.find((card) => /Intel\s*x64/i.test(card.textContent || ""));
    const arm = cards.find((card) => /ARM64/i.test(card.textContent || ""));
    return [
      { el: intel, key: "mac-intel" },
      { el: arm, key: "mac-arm" }
    ].filter((item) => item.el);
  }

  function triggerBrowserDownload(url) {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.rel = "noopener noreferrer";
    anchor.download = "";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  function onMacCardActivate(key) {
    if (isMobileClient()) {
      showToast("请使用电脑下载");
      return;
    }
    resolveDmgUrl(key).then((url) => {
      if (!url) {
        console.info(`[discovery-home] 下载地址未配置：${key}`);
        showToast("下载地址未配置");
        return;
      }
      triggerBrowserDownload(url);
    });
  }

  function bindCard(card, key) {
    if (!card || card.dataset.businessDownloadBound === "1") return;
    card.dataset.businessDownloadBound = "1";
    card.dataset.downloadKey = key;
    if (!card.hasAttribute("tabindex")) card.tabIndex = 0;
    if (!card.getAttribute("role")) card.setAttribute("role", "button");

    card.addEventListener("click", (event) => {
      event.preventDefault();
      onMacCardActivate(key);
    });

    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      onMacCardActivate(key);
    });
  }

  function init() {
    resolveMacCards().forEach(({ el, key }) => bindCard(el, key));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
