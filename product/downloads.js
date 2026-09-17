(function () {
  "use strict";

  const toastIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v6"></path><circle cx="12" cy="16" r="1" fill="currentColor" stroke="none"></circle></svg>';
  let toastTimer = 0;

  /** @type {Record<string, Promise<{ url: string, packageVersion: string }>>} */
  const packageUrlByKey = Object.create(null);

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

  function isMobileDevice() {
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) return true;
    return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  }

  function detectMacArchitectureFromRenderer() {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      const debugInfo = gl?.getExtension("WEBGL_debug_renderer_info");
      const renderer = debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || "") : "";
      return /Apple\s+(?:M\d|GPU|A\d)/i.test(renderer) ? "arm" : "";
    } catch (error) {
      return "";
    }
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
    if (key === "win") return "win";
    return "";
  }

  function packageFormatFor(key) {
    if (key === "win") return "exe";
    return "dmg";
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

  function packageUrlFromManifest(manifest, key) {
    const format = packageFormatFor(key);
    const downloads = Array.isArray(manifest?.downloads) ? manifest.downloads : [];
    const item = downloads.find((entry) => entry && String(entry.format || "").toLowerCase() === format);
    const path = item ? String(item.path || "").trim() : "";
    const url = path ? joinUrl(releaseBase(), path) : "";
    const packageVersion = String(manifest?.version || "").trim();
    return { url, packageVersion };
  }

  function loadPackageUrl(key) {
    const empty = { url: "", packageVersion: "" };
    const manifestUrl = manifestUrlFor(key);
    if (!manifestUrl) return Promise.resolve(empty);

    return fetch(manifestUrl, { credentials: "omit", cache: "no-cache" })
      .then((res) => {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then((manifest) => {
        const result = packageUrlFromManifest(manifest, key);
        if (!result.url) {
          console.info(`[discovery-home] release-manifest 无 ${packageFormatFor(key)}：${key}`, manifestUrl);
        }
        return result;
      })
      .catch((err) => {
        console.info(`[discovery-home] 拉取 release-manifest 失败：${key}`, manifestUrl, err);
        return empty;
      });
  }

  /** 同 key 共用 in-flight；成功结果缓存，失败可重试。 */
  function resolvePackageUrl(key) {
    if (!packageUrlByKey[key]) {
      packageUrlByKey[key] = loadPackageUrl(key).then((result) => {
        if (!result.url) delete packageUrlByKey[key];
        return result;
      });
    }
    return packageUrlByKey[key];
  }

  function resolveDownloadCards() {
    return Array.from(document.querySelectorAll("article.download-card.is-hoverable[data-download-platform]"))
      .map((card) => {
        const platform = String(card.getAttribute("data-download-platform") || "").toLowerCase();
        if (platform === "mac") return { el: card, key: "mac-auto" };
        if (platform === "win") return { el: card, key: "win" };
        return null;
      })
      .filter(Boolean);
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

  function trackVersionFor(key) {
    if (key === "mac-intel") return "mac_intel";
    if (key === "mac-arm") return "mac_arm";
    if (key === "win") return "windows";
    return key;
  }

  function detectDesktopPlatform() {
    if (isMobileDevice()) return "";
    const platform = String(navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || "");
    if (/mac/i.test(platform)) return "mac";
    if (/win/i.test(platform)) return "win";
    return "";
  }

  async function resolveMacArchitectureDownloadKey() {
    if (isMobileDevice()) return "";
    // A non-Mac device cannot identify the chip of the intended Mac.
    if (detectDesktopPlatform() !== "mac") return "mac-intel";

    const uaData = navigator.userAgentData;
    let architecture = String(uaData?.architecture || "");
    if (!architecture && typeof uaData?.getHighEntropyValues === "function") {
      try {
        const values = await uaData.getHighEntropyValues(["architecture"]);
        architecture = String(values?.architecture || "");
      } catch (error) {
        console.info("[discovery-home] 无法读取 macOS 架构，继续检测图形设备", error);
      }
    }
    if (!architecture) architecture = detectMacArchitectureFromRenderer();
    // Keep the existing Intel fallback when the browser hides chip information.
    return /arm|aarch/i.test(architecture) ? "mac-arm" : "mac-intel";
  }

  function resolveRequestedDownloadKey(key) {
    return key === "mac-auto" ? resolveMacArchitectureDownloadKey() : Promise.resolve(key);
  }

  function onDownloadCardActivate(key, options) {
    if (!options?.skipMobileCheck && isMobileClient()) {
      showToast("请使用电脑下载");
      return;
    }
    resolveRequestedDownloadKey(key).then((resolvedKey) => {
      if (!resolvedKey) {
        showToast("请使用电脑下载");
        return null;
      }
      return resolvePackageUrl(resolvedKey).then((result) => ({ result, resolvedKey }));
    }).then((payload) => {
      if (!payload) return;
      const { result, resolvedKey } = payload;
      const url = result && result.url;
      if (!url) {
        console.info(`[discovery-home] 下载地址未配置：${resolvedKey}`);
        showToast("下载地址未配置");
        return;
      }
      triggerBrowserDownload(url);
      // Track only when download actually starts (manifest URL resolved).
      if (window.DiscoveryAnalytics && typeof window.DiscoveryAnalytics.track === "function") {
        const props = { version: trackVersionFor(resolvedKey) };
        const packageVersion = result.packageVersion || "";
        if (packageVersion) props.package_version = packageVersion;
        window.DiscoveryAnalytics.track("download_click", props);
      }
    });
  }

  async function resolveDesktopDownloadKey() {
    const platform = detectDesktopPlatform();
    if (platform === "mac") {
      return resolveMacArchitectureDownloadKey();
    }
    if (platform === "win") return "win";
    return "";
  }

  function updatePlatformIcons() {
    const icons = Array.from(document.querySelectorAll("[data-download-platform-icon]"));
    if (!icons.length) return;

    const platform = detectDesktopPlatform();
    icons.forEach((icon) => {
      icon.hidden = !platform;
      if (platform) icon.dataset.platform = platform;
      else delete icon.dataset.platform;
    });
  }

  function bindNavDownload(button) {
    if (!button || button.dataset.businessDownloadBound === "1") return;
    button.dataset.businessDownloadBound = "1";
    const activate = (event) => {
      event.preventDefault();
      resolveDesktopDownloadKey().then((key) => {
        if (!key) {
          showToast(isMobileDevice() ? "请使用电脑下载" : "暂不支持当前系统下载");
          return;
        }
        onDownloadCardActivate(key, { skipMobileCheck: true });
      });
    };
    button.addEventListener("click", activate);
    button.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      activate(event);
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
      onDownloadCardActivate(key);
    });

    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      onDownloadCardActivate(key);
    });
  }

  function init() {
    resolveDownloadCards().forEach(({ el, key }) => bindCard(el, key));
    document.querySelectorAll("[data-download-nav]").forEach(bindNavDownload);
    updatePlatformIcons();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
