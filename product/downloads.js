(function () {
  "use strict";

  const toastIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v6"></path><circle cx="12" cy="16" r="1" fill="currentColor" stroke="none"></circle></svg>';
  let toastTimer = 0;

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

  function downloadUrl(key) {
    const downloads = window.SiteLinkConfig?.downloads || {};
    if (key === "mac-intel") return String(downloads.macIntel || "").trim();
    if (key === "mac-arm") return String(downloads.macArm || "").trim();
    return "";
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
    const url = downloadUrl(key);
    if (!url) {
      console.info(`[discovery-home] 下载地址未配置：${key}`);
      showToast("下载地址未配置");
      return;
    }
    triggerBrowserDownload(url);
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
