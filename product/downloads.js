(function () {
  "use strict";

  const toastIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v6"></path><circle cx="12" cy="16" r="1" fill="currentColor" stroke="none"></circle></svg>';
  let toastTimer = 0;

  /** @type {Record<string, Promise<{ url: string, packageVersion: string, reason?: string, manifestUrl?: string }>>} */
  const packageUrlByKey = Object.create(null);

  const DOWNLOAD_NETWORK_TOAST = "下载服务暂时无法访问，请检查网络或关闭 VPN 后重试";
  const DOWNLOAD_UNAVAILABLE_TOAST = "下载服务暂时无法访问，请稍后重试";

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
    const manifestUrl = manifestUrlFor(key);
    if (!manifestUrl) {
      return Promise.resolve({
        url: "",
        packageVersion: "",
        reason: "missing_package",
        manifestUrl: ""
      });
    }

    return fetch(manifestUrl, { credentials: "omit", cache: "no-cache" })
      .then((res) => {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then((manifest) => {
        const result = packageUrlFromManifest(manifest, key);
        if (!result.url) {
          return {
            url: "",
            packageVersion: result.packageVersion || "",
            reason: "missing_package",
            manifestUrl
          };
        }
        return { ...result, manifestUrl };
      })
      .catch((err) => {
        console.info(`[discovery-home] 拉取 release-manifest 失败 reason=network key=${key}`, manifestUrl, err);
        return { url: "", packageVersion: "", reason: "network", manifestUrl };
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

  function readQueryParam(name) {
    const fromSearch = (search) => {
      const value = new URLSearchParams(search || "").get(name);
      return value == null ? "" : String(value).trim();
    };
    const own = fromSearch(location.search);
    if (own) return own;
    try {
      if (window.parent && window.parent !== window) {
        return fromSearch(window.parent.location.search);
      }
    } catch (error) {
      // Cross-origin parent access may throw; ignore.
    }
    return "";
  }

  function normalizeDownloadOs(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "windows") return "win";
    if (raw === "macos") return "mac";
    if (raw === "win" || raw === "mac" || raw === "linux") return raw;
    return "";
  }

  function downloadOsOverride() {
    return normalizeDownloadOs(readQueryParam("downloadOs"));
  }

  function detectDesktopPlatform() {
    const override = downloadOsOverride();
    if (override) return override;
    if (isMobileDevice()) return "";
    const uaDataPlatform = String(navigator.userAgentData?.platform || "");
    const navPlatform = String(navigator.platform || "");
    const userAgent = String(navigator.userAgent || "");
    const haystack = `${uaDataPlatform} ${navPlatform} ${userAgent}`;
    if (/android/i.test(haystack)) return "";
    if (/mac/i.test(haystack)) return "mac";
    if (/win/i.test(haystack)) return "win";
    if (/linux/i.test(haystack)) return "linux";
    return "";
  }

  async function resolveMacArchitectureDownloadKey() {
    const osOverride = downloadOsOverride();
    if (osOverride === "mac") {
      const chip = String(readQueryParam("downloadChip") || "").trim().toLowerCase();
      if (chip === "arm") return "mac-arm";
      if (chip === "intel") return "mac-intel";
    } else if (isMobileDevice()) {
      return "";
    }
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
        const reason = (result && result.reason) || "missing_package";
        const manifestUrl = (result && result.manifestUrl) || manifestUrlFor(key);
        console.info(`[discovery-home] 下载不可用 reason=${reason} key=${key}`, manifestUrl);
        showToast(reason === "network" ? DOWNLOAD_NETWORK_TOAST : DOWNLOAD_UNAVAILABLE_TOAST);
        if (window.DiscoveryAnalytics && typeof window.DiscoveryAnalytics.track === "function") {
          const eventName =
            reason === "network" ? "home_download_network_error_toast" : "home_download_response_error";
          const props = { version: trackVersionFor(resolvedKey) };
          const packageVersion = result.packageVersion || "";
          if (packageVersion) props.package_version = packageVersion;
          window.DiscoveryAnalytics.track(eventName, props);
        }
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

  function heroDownloadLabelFor(platform) {
    if (platform === "win") return "下载 Windows 版";
    if (platform === "mac") return "下载 macOS 版";
    return "下载客户端";
  }

  function chipItemsOf(cta) {
    return Array.from(cta.querySelectorAll("[data-download-key]"));
  }

  function setDownloadCtaOpen(cta, open) {
    const trigger = cta.querySelector("[data-download-nav]");
    const menu = cta.querySelector("[data-download-menu]");
    cta.classList.toggle("is-open", open);
    if (open) cta.classList.remove("is-dismissed");
    if (trigger?.hasAttribute("aria-haspopup")) {
      trigger.setAttribute("aria-expanded", String(open));
    }
    if (menu) menu.setAttribute("aria-hidden", String(!open));
    if (!open) chipItemsOf(cta).forEach((item) => { item.tabIndex = -1; });
  }

  function dismissDownloadCta(cta) {
    setDownloadCtaOpen(cta, false);
    cta.classList.add("is-dismissed");
  }

  function closeAllDownloadCtas(except) {
    document.querySelectorAll("[data-download-cta].is-open").forEach((cta) => {
      if (cta !== except) setDownloadCtaOpen(cta, false);
    });
  }

  function focusChipItem(cta, index) {
    const items = chipItemsOf(cta);
    if (!items.length) return;
    const next = (index + items.length) % items.length;
    items.forEach((item, itemIndex) => {
      item.tabIndex = itemIndex === next ? 0 : -1;
    });
    items[next].focus();
  }

  function activateResolvedDownload(key) {
    if (!key) {
      showToast(isMobileDevice() ? "请使用电脑下载" : "暂不支持当前系统下载");
      return;
    }
    onDownloadCardActivate(key, { skipMobileCheck: true });
  }

  function updatePlatformDownloadCta() {
    const platform = detectDesktopPlatform();
    document.documentElement.setAttribute("data-download-os", platform);

    const showHeroIcon = platform === "mac" || platform === "win";
    document.querySelectorAll("[data-download-platform-icon]").forEach((icon) => {
      icon.hidden = !showHeroIcon;
      if (showHeroIcon) icon.dataset.platform = platform;
      else delete icon.dataset.platform;
    });
    document.querySelectorAll("[data-download-platform-label]").forEach((label) => {
      label.textContent = heroDownloadLabelFor(platform);
    });

    document.querySelectorAll("[data-download-cta]").forEach((cta) => {
      cta.hidden = platform === "linux";
      const trigger = cta.querySelector("[data-download-nav]");
      if (!trigger) return;
      if (platform === "mac") {
        trigger.setAttribute("aria-haspopup", "menu");
        trigger.setAttribute("aria-expanded", "false");
      } else {
        trigger.removeAttribute("aria-haspopup");
        trigger.removeAttribute("aria-expanded");
        setDownloadCtaOpen(cta, false);
        cta.classList.remove("is-dismissed");
      }
    });

    document.querySelectorAll("[data-linux-download]").forEach((el) => {
      el.hidden = platform !== "linux";
    });

    document.querySelectorAll(".hero-online").forEach((link) => {
      if (platform === "linux") {
        link.classList.remove("btn");
        link.classList.add("btn-primary");
      } else {
        link.classList.add("btn");
        link.classList.remove("btn-primary");
      }
    });
  }

  function bindNavDownload(button) {
    if (!button || button.dataset.businessDownloadBound === "1") return;
    button.dataset.businessDownloadBound = "1";
    button.addEventListener("click", (event) => {
      if (event.target.closest("[data-download-key]")) return;
      event.preventDefault();
      resolveDesktopDownloadKey().then(activateResolvedDownload);
    });
  }

  function bindChipDownload(button) {
    if (!button || button.dataset.businessDownloadBound === "1") return;
    button.dataset.businessDownloadBound = "1";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const key = String(button.getAttribute("data-download-key") || "");
      activateResolvedDownload(key);
      const cta = button.closest("[data-download-cta]");
      if (cta) dismissDownloadCta(cta);
    });
  }

  function bindDownloadCta(cta) {
    if (!cta || cta.dataset.businessDownloadMenuBound === "1") return;
    cta.dataset.businessDownloadMenuBound = "1";
    const trigger = cta.querySelector("[data-download-nav]");
    const menu = cta.querySelector("[data-download-menu]");
    if (!trigger || !menu) return;

    const openIfMac = () => {
      if (detectDesktopPlatform() !== "mac") return;
      closeAllDownloadCtas(cta);
      setDownloadCtaOpen(cta, true);
    };

    cta.addEventListener("mouseenter", openIfMac);
    cta.addEventListener("mouseleave", () => {
      setDownloadCtaOpen(cta, false);
      cta.classList.remove("is-dismissed");
    });
    cta.addEventListener("focusin", openIfMac);
    cta.addEventListener("focusout", (event) => {
      if (cta.contains(event.relatedTarget)) return;
      setDownloadCtaOpen(cta, false);
      cta.classList.remove("is-dismissed");
    });

    trigger.addEventListener("keydown", (event) => {
      if (detectDesktopPlatform() !== "mac") return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        openIfMac();
        focusChipItem(cta, event.key === "ArrowUp" ? chipItemsOf(cta).length - 1 : 0);
      } else if (event.key === "Escape") {
        event.preventDefault();
        dismissDownloadCta(cta);
      }
    });

    menu.addEventListener("keydown", (event) => {
      if (detectDesktopPlatform() !== "mac") return;
      const items = chipItemsOf(cta);
      const current = items.indexOf(document.activeElement);
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const delta = event.key === "ArrowDown" ? 1 : -1;
        focusChipItem(cta, current < 0 ? 0 : current + delta);
      } else if (event.key === "Home") {
        event.preventDefault();
        focusChipItem(cta, 0);
      } else if (event.key === "End") {
        event.preventDefault();
        focusChipItem(cta, items.length - 1);
      } else if (event.key === "Escape") {
        event.preventDefault();
        dismissDownloadCta(cta);
        trigger.focus();
      }
    });
  }

  function bindDownloadMenuChrome() {
    document.addEventListener("pointerdown", (event) => {
      const inside = event.target.closest("[data-download-cta]");
      document.querySelectorAll("[data-download-cta]").forEach((cta) => {
        if (cta === inside) return;
        setDownloadCtaOpen(cta, false);
        cta.classList.remove("is-dismissed");
      });
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      document.querySelectorAll("[data-download-cta].is-open").forEach((cta) => {
        dismissDownloadCta(cta);
        cta.querySelector("[data-download-nav]")?.focus();
      });
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

  function bindChipButton(button) {
    if (!button || button.dataset.businessDownloadBound === "1") return;
    const key = String(button.getAttribute("data-download-key") || "").toLowerCase();
    if (key !== "mac-arm" && key !== "mac-intel") return;
    button.dataset.businessDownloadBound = "1";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onDownloadCardActivate(key);
    });
  }

  function init() {
    resolveDownloadCards().forEach(({ el, key }) => bindCard(el, key));
    document.querySelectorAll("button.download-chip-btn[data-download-key]").forEach(bindChipButton);
    document.querySelectorAll("[data-download-nav]").forEach(bindNavDownload);
    document.querySelectorAll("[data-download-menu] [data-download-key]").forEach(bindChipDownload);
    document.querySelectorAll("[data-download-cta]").forEach(bindDownloadCta);
    bindDownloadMenuChrome();
    updatePlatformDownloadCta();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
