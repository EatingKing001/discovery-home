(function initializeHomePage() {
  "use strict";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const embedded = window.parent !== window && new URLSearchParams(window.location.search).has("embedded");
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const discoveryBase = window.SiteLinkConfig?.discoveryWebApp || "https://discovery.intern-ai.org.cn/chat";
  const discoveryUrl =
    window.DiscoveryChannelTrack && typeof window.DiscoveryChannelTrack.appendToUrl === "function"
      ? window.DiscoveryChannelTrack.appendToUrl(discoveryBase)
      : discoveryBase;
  const isLocalFileContext = window.location.protocol === "file:" || window.location.origin === "null";
  const messageTargetOrigin = isLocalFileContext ? "*" : window.location.origin;
  const allowedAnchors = new Set(["home-hero", "home-advantages", "home-workflow", "home-research-foundation", "home-research-cases", "home-cooperation", "home-downloads"]);
  const navigationAnchorBySection = new Map([
    ["home-hero", ""],
    ["home-advantages", "home-advantages"],
    ["home-workflow", "home-advantages"],
    ["home-disciplines", "home-advantages"],
    ["home-outputs", "home-advantages"],
    ["home-evidence-chain", "home-advantages"],
    ["home-security", "home-advantages"],
    ["home-ecosystem", "home-advantages"],
    ["home-research-foundation", "home-research-foundation"],
    ["home-research-cases", "home-research-cases"],
    ["home-cooperation", "home-cooperation"],
    ["home-downloads", "home-downloads"]
  ]);
  let anchorFocusTimer = 0;
  let anchorScrollSequence = 0;
  let lastShellCooperationTrigger = null;
  let shellCooperationRequestId = "";
  let shellCooperationRetryTimer = 0;

  if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";

  function resetInitialScrollPosition() {
    if (anchorScrollSequence || window.location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }

  function startHeroMotionAfterAssets() {
    if (!document.documentElement.classList.contains("motion-ready")) return;
    const heroImages = Array.from(document.querySelectorAll(".hero-stage img"));
    const heroAssets = heroImages.map((image) => new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        image.removeEventListener("load", finish);
        image.removeEventListener("error", finish);
        resolve();
      };
      image.addEventListener("load", finish, { once: true });
      image.addEventListener("error", finish, { once: true });
      if (image.complete) finish();
    }).then(() => (typeof image.decode === "function" ? image.decode().catch(() => undefined) : undefined)));

    // Resolve the title's web font before revealing it to avoid a visible font swap.
    const heroHeading = document.querySelector(".hero-introduction h1");
    if (document.fonts && heroHeading) {
      const headingStyle = window.getComputedStyle(heroHeading);
      const headingFont = `${headingStyle.fontWeight} ${headingStyle.fontSize} ${headingStyle.fontFamily}`;
      heroAssets.push(document.fonts.load(headingFont, heroHeading.textContent).catch(() => undefined));
    }

    let timeoutId;
    const timeout = new Promise((resolve) => { timeoutId = window.setTimeout(resolve, 4000); });
    Promise.race([Promise.all(heroAssets), timeout]).then(() => {
      window.clearTimeout(timeoutId);
      window.requestAnimationFrame(() => document.documentElement.classList.add("hero-assets-ready"));
    });
  }

  // A defer script runs while readyState is "interactive", before theme.js swaps
  // the picture sources at DOMContentLoaded. Wait a frame after that swap so
  // load/decode observes the final themed image, including on cached revisits.
  const queueHeroMotion = () => window.requestAnimationFrame(startHeroMotionAfterAssets);
  if (document.readyState === "complete") queueHeroMotion();
  else document.addEventListener("DOMContentLoaded", queueHeroMotion, { once: true });

  resetInitialScrollPosition();

  document.querySelectorAll("[data-discovery-link]").forEach((link) => { link.href = discoveryUrl; });

  let discoveryS2Base = discoveryBase;
  try {
    const s2Url = new URL(discoveryBase, window.location.href);
    s2Url.searchParams.set("model", "S2");
    s2Url.searchParams.set("show_model_tip", "1");
    discoveryS2Base = s2Url.toString();
  } catch (_) { /* keep discoveryBase */ }
  const discoveryS2Url =
    window.DiscoveryChannelTrack && typeof window.DiscoveryChannelTrack.appendToUrl === "function"
      ? window.DiscoveryChannelTrack.appendToUrl(discoveryS2Base)
      : discoveryS2Base;
  document.querySelectorAll("[data-discovery-link-s2]").forEach((link) => { link.href = discoveryS2Url; });

  function postToShell(message) {
    if (!embedded) return;
    try {
      window.parent.postMessage(message, messageTargetOrigin);
    } catch (error) {
      if (messageTargetOrigin === "*") throw error;
      window.parent.postMessage(message, "*");
    }
  }

  function scrollToAnchor(anchorId, behavior = "smooth", requestId = "") {
    const target = document.getElementById(anchorId);
    if (!target) return;
    const effectiveBehavior = reducedMotion.matches ? "auto" : behavior;
    const sequence = ++anchorScrollSequence;
    const heading = target.querySelector("h1, h2, h3") || target;
    if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
    if (window.location.hash !== `#${anchorId}`) {
      try {
        window.history.replaceState(null, "", `#${anchorId}`);
      } catch (error) {
        /* Opaque local-preview origins can reject History API updates; scrolling must still continue. */
      }
    }
    target.scrollIntoView({ behavior: effectiveBehavior, block: "start" });
    window.clearTimeout(anchorFocusTimer);
    let completed = false;
    const finish = () => {
      if (sequence !== anchorScrollSequence || completed) return;
      completed = true;
      window.clearTimeout(anchorFocusTimer);
      window.removeEventListener("scrollend", finish);
      heading.focus({ preventScroll: true });
      if (embedded && requestId) {
        postToShell({ type: "home:anchor:scrolled", requestId, anchorId });
      }
    };
    if (effectiveBehavior === "auto") anchorFocusTimer = window.setTimeout(finish, 0);
    else {
      const supportsScrollEnd = "onscrollend" in window;
      if (supportsScrollEnd) window.addEventListener("scrollend", finish, { once: true });
      anchorFocusTimer = window.setTimeout(finish, supportsScrollEnd ? 4000 : 1800);
    }
  }

  function setStandaloneActiveAnchor(anchorId) {
    document.querySelectorAll(".standalone-nav [data-home-anchor]").forEach((anchor) => {
      if (anchor.dataset.homeAnchor === anchorId) anchor.setAttribute("aria-current", "true");
      else anchor.removeAttribute("aria-current");
    });
  }

  function requestShellCooperationDialog(trigger) {
    lastShellCooperationTrigger = trigger;
    const requestId = `cooperation-open-${Date.now()}`;
    const request = { type: "home:cooperation-dialog:open", requestId };
    shellCooperationRequestId = requestId;
    window.clearTimeout(shellCooperationRetryTimer);
    postToShell(request);
    shellCooperationRetryTimer = window.setTimeout(() => {
      if (shellCooperationRequestId === requestId) postToShell(request);
    }, 300);
  }

  document.addEventListener("click", (event) => {
    const anchor = event.target.closest("[data-home-anchor]");
    if (anchor) {
      event.preventDefault();
      scrollToAnchor(anchor.dataset.homeAnchor);
      return;
    }
    if (event.target.closest("[data-refresh-page]")) {
      window.location.reload();
      return;
    }
    const cooperationTrigger = event.target.closest("[data-open-cooperation]");
    if (cooperationTrigger) {
      if (embedded) requestShellCooperationDialog(cooperationTrigger);
      else openStandaloneCooperationDialog(cooperationTrigger);
      return;
    }
    const scpLabApplyTrigger = event.target.closest("[data-open-scp-lab-apply]");
    if (scpLabApplyTrigger) {
      if (embedded) requestShellScpLabDialog(scpLabApplyTrigger);
      else openStandaloneScpLabDialog(scpLabApplyTrigger);
    }
  });

  window.addEventListener("message", (event) => {
    if (!embedded || event.source !== window.parent) return;
    if (messageTargetOrigin !== "*" && event.origin !== messageTargetOrigin) return;
    if (!event.data || typeof event.data !== "object") return;
    if (event.data.type === "home:anchor:scroll" && allowedAnchors.has(event.data.anchorId)) {
      const behavior = event.data.behavior === "auto" ? "auto" : "smooth";
      const requestId = typeof event.data.requestId === "string" ? event.data.requestId : "";
      scrollToAnchor(event.data.anchorId, behavior, requestId);
    } else if (event.data.type === "home:cooperation-dialog:opened" && event.data.requestId === shellCooperationRequestId) {
      window.clearTimeout(shellCooperationRetryTimer);
      shellCooperationRequestId = "";
    } else if (event.data.type === "home:cooperation-dialog:closed") {
      window.clearTimeout(shellCooperationRetryTimer);
      shellCooperationRequestId = "";
      if (lastShellCooperationTrigger?.isConnected) lastShellCooperationTrigger.focus({ preventScroll: true });
      lastShellCooperationTrigger = null;
    } else if (event.data.type === "home:scplab-dialog:opened" && event.data.requestId === scpLabApplyRequestId) {
      window.clearTimeout(scpLabApplyRetryTimer);
      scpLabApplyRequestId = "";
    } else if (event.data.type === "home:scplab-dialog:closed") {
      window.clearTimeout(scpLabApplyRetryTimer);
      scpLabApplyRequestId = "";
      if (lastScpLabApplyTrigger?.isConnected) lastScpLabApplyTrigger.focus({ preventScroll: true });
      lastScpLabApplyTrigger = null;
    }
  });

  if (embedded) postToShell({ type: "home:ready" });

  /* Exact-coordinate diagrams: only their complete reference canvas is scaled. */
  const diagramObservers = [];
  document.querySelectorAll("[data-scaled-diagram]").forEach((wrapper) => {
    const designWidth = Number(wrapper.dataset.designWidth);
    const designHeight = Number(wrapper.dataset.designHeight);
    const canvas = wrapper.firstElementChild;
    const resize = () => {
      const scale = Math.min(1, wrapper.clientWidth / designWidth);
      wrapper.style.height = `${designHeight * scale}px`;
      canvas.style.setProperty("--diagram-scale", scale);
      canvas.style.setProperty("--design-width", designWidth);
      canvas.style.setProperty("--design-height", designHeight);
    };
    resize();
    if ("ResizeObserver" in window) {
      const observer = new ResizeObserver(resize);
      observer.observe(wrapper);
      diagramObservers.push(observer);
    } else window.addEventListener("resize", resize, { passive: true });
  });

  const evidenceScaler = document.querySelector("[data-evidence-scaler]");
  if (evidenceScaler) {
    const resizeEvidence = () => {
      const scale = Math.min(1, evidenceScaler.clientWidth / 800);
      evidenceScaler.style.setProperty("--evidence-scale", scale);
      evidenceScaler.style.height = `${480 * scale}px`;
    };
    resizeEvidence();
    if ("ResizeObserver" in window) {
      const evidenceResizeObserver = new ResizeObserver(resizeEvidence);
      evidenceResizeObserver.observe(evidenceScaler);
      diagramObservers.push(evidenceResizeObserver);
    } else window.addEventListener("resize", resizeEvidence, { passive: true });
  }

  /* Gentle section reveals: keep the page readable while giving each module a
     small, one-time entrance as it reaches the viewport. */
  const motionSectionSelectors = new Map([
    ["advantage-section", [".section-heading", ".feature-card"]],
    ["workflow-section", [".section-heading"]],
    ["discipline-section", [".section-heading"]],
    ["outputs-section", [".section-heading", ".output-card"]],
    ["evidence-section", [".section-heading", ".evidence-layout"]],
    ["security-section", [".section-heading", ".security-figure"]],
    ["ecosystem-section", [".section-heading", ".ecosystem-figure"]],
    ["foundation-section", [".section-heading", ".foundation-art", ".capability-grid > article"]],
    ["cases-section", [".section-heading", ".case-showcase"]],
    ["cooperation-section", [".section-heading", ".cooperation-showcase"]],
    ["downloads-section", [".downloads-heading", ".download-grid"]]
  ]);
  const motionItems = [];
  motionSectionSelectors.forEach((selectors, sectionClass) => {
    const section = document.querySelector(`.${sectionClass}`);
    if (!section) return;
    section.classList.add("motion-section");
    let sectionMotionIndex = 0;
    selectors.forEach((selector) => {
      section.querySelectorAll(selector).forEach((element) => {
        element.classList.add("motion-item");
        element.style.setProperty("--motion-index", String(Math.min(sectionMotionIndex++, 5)));
        motionItems.push(element);
      });
    });
  });
  const motionObserver = "IntersectionObserver" in window ? new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      motionObserver.unobserve(entry.target);
    });
  }, { threshold: 0.16, rootMargin: "0px 0px -8%" }) : null;
  if (motionObserver) {
    document.documentElement.classList.add("motion-ready");
    motionItems.forEach((item) => motionObserver.observe(item));
  }
  document.addEventListener("focusin", (event) => {
    const item = event.target.closest(".motion-item");
    if (!item) return;
    item.classList.add("is-visible");
    motionObserver?.unobserve(item);
  });

  const revealObserver = "IntersectionObserver" in window ? new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-revealed");
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: 0.22 }) : null;
  const workflow = document.querySelector(".workflow-section");
  const disciplines = document.querySelector("[data-discipline-reveal]");
  [workflow, disciplines].filter(Boolean).forEach((section) => {
    if (revealObserver) revealObserver.observe(section);
    else section.classList.add("is-revealed");
  });

  const partnerData = window.HomePartnerLogos || { line1: [], line2: [], line3: [] };
  const partnerPixelsPerSecond = 22;
  const partnerWall = document.querySelector(".partner-wall");
  let partnerTracksInitialized = false;
  const currentTheme = () => document.documentElement.getAttribute("data-theme");

  function initializePartnerTracks() {
    if (partnerTracksInitialized) return;
    partnerTracksInitialized = true;
    document.querySelectorAll("[data-partner-line]").forEach((track) => {
      const logos = partnerData[track.dataset.partnerLine] || [];
      const fragment = document.createDocumentFragment();
      [...logos, ...logos].forEach((logo, index) => {
        const item = document.createElement("div");
        item.className = "partner-logo";
        item.dataset.orgName = logo.name;
        if (index >= logos.length) item.setAttribute("aria-hidden", "true");
        else {
          item.tabIndex = 0;
          item.setAttribute("role", "img");
          item.setAttribute("aria-label", logo.name);
        }
        const image = document.createElement("img");
        image.alt = "";
        image.width = 60;
        image.height = 60;
        image.loading = "lazy";
        image.decoding = "async";
        image.fetchPriority = "low";
        if (logo.darkSrc) {
          image.dataset.themeSrcLight = logo.src;
          image.dataset.themeSrcDark = logo.darkSrc;
          image.src = currentTheme() === "dark" ? logo.darkSrc : logo.src;
        } else image.src = logo.src;
        const name = document.createElement("span");
        name.className = "partner-logo-name";
        name.textContent = logo.name;
        name.setAttribute("aria-hidden", "true");
        item.append(image, name);
        fragment.append(item);
      });
      track.replaceChildren(fragment);
      const updatePartnerDuration = () => {
        const loopDistance = track.scrollWidth / 2;
        if (loopDistance > 0) track.style.setProperty("--partner-duration", `${loopDistance / partnerPixelsPerSecond}s`);
      };
      updatePartnerDuration();
      if ("ResizeObserver" in window) {
        const partnerResizeObserver = new ResizeObserver(updatePartnerDuration);
        partnerResizeObserver.observe(track);
      } else window.addEventListener("resize", updatePartnerDuration, { passive: true });
    });
  }

  if (partnerWall) {
    if ("IntersectionObserver" in window) {
      const partnerInitObserver = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        initializePartnerTracks();
        partnerInitObserver.disconnect();
      }, { rootMargin: "1000px 0px" });
      partnerInitObserver.observe(partnerWall);
    } else initializePartnerTracks();
  }

  /* Shared scroll frame: hero exit, shallow image parallax, and section state. */
  const introduction = document.querySelector("[data-hero-introduction]");
  const heroStage = document.querySelector("[data-hero-stage]");
  const parallaxItems = Array.from(document.querySelectorAll("[data-parallax-speed]"));
  function updateHeroMobileScale() {
    if (!heroStage) return;
    const viewportWidth = document.documentElement.clientWidth;
    if (viewportWidth <= 767) {
      const heroSideGutter = 32;
      const heroArtworkLeft = 112;
      const heroArtworkRight = 1385;
      const heroArtworkCenterOffset = (heroArtworkLeft + heroArtworkRight) / 2 - 720;
      const scale = Math.min(0.4305556, Math.max(0.16, (viewportWidth - heroSideGutter * 2) / (heroArtworkRight - heroArtworkLeft)));
      heroStage.style.setProperty("--hero-mobile-scale", String(scale));
      heroStage.style.setProperty("--hero-mobile-offset", `${heroArtworkCenterOffset * scale}px`);
    } else {
      heroStage.style.removeProperty("--hero-mobile-scale");
      heroStage.style.removeProperty("--hero-mobile-offset");
    }
  }
  updateHeroMobileScale();
  let scrollFrame = 0;
  function updateScrollEffects() {
    scrollFrame = 0;
    const scrollY = window.scrollY;
    if (introduction) {
      if (reducedMotion.matches) {
        introduction.style.transform = "";
        introduction.style.filter = "";
        introduction.style.opacity = "";
        introduction.style.pointerEvents = "auto";
      } else {
        const progress = clamp(scrollY / 446);
        introduction.style.transform = `translate3d(0, ${progress * 96}px, 0) scale(${1 - progress * 0.3})`;
        introduction.style.filter = `blur(${progress * 12}px)`;
        introduction.style.opacity = String(1 - progress);
        introduction.style.pointerEvents = progress > 0.8 ? "none" : "auto";
      }
    }
    const heroScroll = clamp(scrollY, 0, 1306);
    parallaxItems.forEach((item) => {
      if (reducedMotion.matches) { item.style.transform = ""; return; }
      const speed = Number(item.dataset.parallaxSpeed || 0);
      const rect = item.getBoundingClientRect();
      const offset = item.closest("[data-hero-stage]")
        ? heroScroll * speed
        : (rect.top + rect.height / 2 - innerHeight / 2) * speed;
      item.style.transform = `translate3d(0, ${offset}px, 0)`;
    });
  }
  function requestScrollUpdate() {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScrollEffects);
  }
  addEventListener("scroll", requestScrollUpdate, { passive: true });
  addEventListener("resize", () => {
    updateHeroMobileScale();
    requestScrollUpdate();
  }, { passive: true });
  reducedMotion.addEventListener?.("change", requestScrollUpdate);
  updateScrollEffects();

  const sectionEntries = new Map();
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => { sectionEntries.set(entry.target.id, entry); });
    const visible = Array.from(sectionEntries.values()).filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    const navigationAnchorId = navigationAnchorBySection.get(visible.target.id);
    if (navigationAnchorId === undefined) return;
    setStandaloneActiveAnchor(navigationAnchorId);
    if (embedded) postToShell({ type: "home:section:active", anchorId: navigationAnchorId });
  }, { rootMargin: "-28% 0px -60%", threshold: [0, .1, .3, .6] });
  navigationAnchorBySection.forEach((anchorId, sectionId) => {
    const section = document.getElementById(sectionId);
    if (section) sectionObserver.observe(section);
  });

  /* Evidence tabs: user-controlled selection only. */
  const evidenceTabList = document.querySelector(".evidence-tabs");
  const evidenceTabs = Array.from(document.querySelectorAll(".evidence-tab"));
  const evidencePanels = Array.from(document.querySelectorAll(".evidence-panel"));
  const evidenceSection = document.querySelector(".evidence-section");
  const evidenceMobileSummary = document.querySelector("[data-evidence-mobile-summary]");
  const evidenceMobileDescription = evidenceMobileSummary?.querySelector("p");
  const evidenceMobileQuery = window.matchMedia("(max-width: 767px)");
  let evidenceIndex = 0;
  evidenceTabList?.setAttribute("aria-orientation", evidenceMobileQuery.matches ? "horizontal" : "vertical");

  function loadEvidenceAssets() {
    evidenceSection?.querySelectorAll("img[data-evidence-src]").forEach((image) => {
      image.src = image.dataset.evidenceSrc;
      delete image.dataset.evidenceSrc;
    });
  }

  /* Center the active tab inside the mobile tab strip only; never scroll the
     page itself (scrollIntoView would drag the window to the evidence section
     on load and on breakpoint changes). */
  function centerEvidenceTab(tab) {
    if (!evidenceTabList) return;
    const stripRect = evidenceTabList.getBoundingClientRect();
    const tabRect = tab.getBoundingClientRect();
    const delta = tabRect.left + tabRect.width / 2 - (stripRect.left + stripRect.width / 2);
    if (Math.abs(delta) < 1) return;
    evidenceTabList.scrollBy({ left: delta, behavior: reducedMotion.matches ? "auto" : "smooth" });
  }

  function selectEvidence(index, focusTab = false) {
    evidenceIndex = (index + evidenceTabs.length) % evidenceTabs.length;
    evidenceTabs.forEach((tab, tabIndex) => {
      const active = tabIndex === evidenceIndex;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active && focusTab) tab.focus();
      if (active && evidenceMobileQuery.matches) centerEvidenceTab(tab);
    });
    if (evidenceMobileDescription) evidenceMobileDescription.textContent = evidenceTabs[evidenceIndex].querySelector("span")?.textContent || "";
    evidenceTabList?.setAttribute("aria-orientation", evidenceMobileQuery.matches ? "horizontal" : "vertical");
    evidencePanels.forEach((panel, panelIndex) => {
      const active = panelIndex === evidenceIndex;
      panel.hidden = !active;
      panel.classList.toggle("is-active", active);
    });
  }

  evidenceTabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      selectEvidence(index);
    });
    tab.addEventListener("keydown", (event) => {
      let next = null;
      if (event.key === "ArrowDown" || event.key === "ArrowRight") next = evidenceIndex + 1;
      else if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = evidenceIndex - 1;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = evidenceTabs.length - 1;
      if (next !== null) {
        event.preventDefault();
        selectEvidence(next, true);
      }
    });
  });
  evidenceMobileQuery.addEventListener?.("change", () => selectEvidence(evidenceIndex));
  selectEvidence(evidenceIndex);
  if (evidenceSection) {
    if ("IntersectionObserver" in window) {
      const evidenceAssetObserver = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        loadEvidenceAssets();
        evidenceAssetObserver.disconnect();
      }, { rootMargin: "1000px 0px" });
      evidenceAssetObserver.observe(evidenceSection);
    } else loadEvidenceAssets();
  }

  /* Research cases consume the local static dataset. */
  const caseData = window.HomeResearchCases || [];
  const caseTabs = document.querySelector("[data-case-tabs]");
  const caseDetail = document.querySelector("[data-case-detail]");
  const caseMobileQuery = window.matchMedia("(max-width: 767px)");
  let activeCase = 0;
  let caseRenderTimer = 0;
  let caseEnterFrame = 0;
  let caseSwipeState = null;
  let caseSwipeLockedUntil = 0;

  function syncCaseTabsOrientation() {
    caseTabs?.setAttribute("aria-orientation", caseMobileQuery.matches ? "horizontal" : "vertical");
  }

  function resetCaseMotion() {
    window.cancelAnimationFrame(caseEnterFrame);
    caseDetail?.classList.remove(
      "is-switching",
      "is-dragging",
      "is-snapping-back",
      "is-slide-out-left",
      "is-slide-out-right",
      "is-slide-in-left",
      "is-slide-in-right"
    );
    caseDetail?.style.removeProperty("--case-swipe-x");
  }

  function renderCasePicture(src, alt) {
    const source = String(src);
    const match = source.match(/^(.*?)(\.png)(\?.*)?$/);
    const base = match?.[1] || source.replace(/\.png$/, "");
    const query = match?.[3] || "";
    const sizes = "(max-width: 767px) calc(100vw - 40px), 720px";
    return `<picture><source type="image/avif" srcset="${base}@1x.avif${query} 1x, ${base}@2x.avif${query} 2x" sizes="${sizes}"><source type="image/webp" srcset="${base}@1x.webp${query} 1x, ${base}@2x.webp${query} 2x" sizes="${sizes}"><img src="${base}@1x.png${query}" srcset="${base}@1x.png${query} 1x, ${base}@2x.png${query} 2x" sizes="${sizes}" alt="${alt}" width="720" height="405" loading="lazy" decoding="async" fetchpriority="low"></picture>`;
  }

  function renderCase(index, focusTab = false, requestedDirection = 0) {
    if (!caseData.length || !caseDetail) return;
    window.clearTimeout(caseRenderTimer);
    const previousCase = activeCase;
    activeCase = (index + caseData.length) % caseData.length;
    const item = caseData[activeCase];
    const slideDirection = caseMobileQuery.matches && activeCase !== previousCase
      ? (requestedDirection || Math.sign(activeCase - previousCase))
      : 0;
    if (slideDirection && !reducedMotion.matches) caseSwipeLockedUntil = performance.now() + 500;
    caseTabs.querySelectorAll(".case-tab").forEach((tab, tabIndex) => {
      const active = tabIndex === activeCase;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active) caseDetail.setAttribute("aria-labelledby", tab.id);
      if (active && focusTab) tab.focus();
      if (active && (focusTab || slideDirection)) tab.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "nearest", inline: "center" });
    });
    resetCaseMotion();
    caseDetail.classList.add(slideDirection > 0 ? "is-slide-out-left" : slideDirection < 0 ? "is-slide-out-right" : "is-switching");
    const update = () => {
      caseDetail.innerHTML = `<div class="case-copy"><span class="case-field">${item.primaryField} · ${item.secondaryField}</span><h3>${item.title}</h3><p>${item.highlight}</p></div><div class="case-media">${renderCasePicture(item.image, item.imageAlt)}</div><dl class="case-meta"><div><dt>联合单位：</dt><dd>${item.partners}</dd></div></dl>`;
      resetCaseMotion();
      if (!slideDirection || reducedMotion.matches) return;
      caseDetail.classList.add(slideDirection > 0 ? "is-slide-in-right" : "is-slide-in-left");
      caseEnterFrame = window.requestAnimationFrame(() => {
        caseEnterFrame = window.requestAnimationFrame(() => {
          caseDetail.classList.remove("is-slide-in-left", "is-slide-in-right");
        });
      });
    };
    if (reducedMotion.matches) update();
    else caseRenderTimer = window.setTimeout(update, slideDirection ? 220 : 150);
  }

  function finishCaseSwipe(event, cancelled = false) {
    if (!caseSwipeState || event.pointerId !== caseSwipeState.pointerId) return;
    const state = caseSwipeState;
    caseSwipeState = null;
    if (caseDetail.hasPointerCapture?.(event.pointerId)) caseDetail.releasePointerCapture(event.pointerId);

    const elapsed = Math.max(performance.now() - state.startedAt, 1);
    const velocity = state.deltaX / elapsed;
    const threshold = Math.min(96, caseDetail.clientWidth * 0.2);
    const shouldChange = !cancelled && state.axis === "x" && (Math.abs(state.deltaX) >= threshold || Math.abs(velocity) >= 0.55);
    const direction = state.deltaX < 0 ? 1 : -1;
    const nextCase = activeCase + direction;

    if (shouldChange && nextCase >= 0 && nextCase < caseData.length) {
      resetCaseMotion();
      renderCase(nextCase, false, direction);
      return;
    }

    caseDetail.classList.remove("is-dragging");
    caseDetail.classList.add("is-snapping-back");
    caseDetail.style.setProperty("--case-swipe-x", "0px");
    window.setTimeout(() => resetCaseMotion(), reducedMotion.matches ? 0 : 260);
  }

  function bindCaseSwipe() {
    if (!caseDetail) return;
    caseDetail.addEventListener("pointerdown", (event) => {
      if (!caseMobileQuery.matches || !event.isPrimary || performance.now() < caseSwipeLockedUntil) return;
      window.clearTimeout(caseRenderTimer);
      resetCaseMotion();
      caseSwipeState = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        deltaX: 0,
        axis: "",
        startedAt: performance.now()
      };
      caseDetail.setPointerCapture?.(event.pointerId);
    });

    caseDetail.addEventListener("pointermove", (event) => {
      if (!caseSwipeState || event.pointerId !== caseSwipeState.pointerId) return;
      const deltaX = event.clientX - caseSwipeState.startX;
      const deltaY = event.clientY - caseSwipeState.startY;
      if (!caseSwipeState.axis && Math.max(Math.abs(deltaX), Math.abs(deltaY)) >= 8) {
        caseSwipeState.axis = Math.abs(deltaX) > Math.abs(deltaY) * 1.15 ? "x" : "y";
      }
      if (caseSwipeState.axis !== "x") return;
      event.preventDefault();
      const atStart = activeCase === 0 && deltaX > 0;
      const atEnd = activeCase === caseData.length - 1 && deltaX < 0;
      caseSwipeState.deltaX = (atStart || atEnd) ? deltaX * 0.24 : deltaX;
      caseDetail.classList.add("is-dragging");
      caseDetail.style.setProperty("--case-swipe-x", `${caseSwipeState.deltaX}px`);
    });

    caseDetail.addEventListener("pointerup", (event) => finishCaseSwipe(event));
    caseDetail.addEventListener("pointercancel", (event) => finishCaseSwipe(event, true));
  }

  if (caseTabs && caseData.length) {
    caseDetail.id ||= "research-case-panel";
    caseDetail.setAttribute("role", "tabpanel");
    caseData.forEach((item, index) => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = `case-tab${index === 0 ? " is-active" : ""}`;
      tab.id = `case-tab-${item.id}`;
      tab.role = "tab";
      tab.setAttribute("aria-controls", caseDetail.id);
      tab.setAttribute("aria-selected", String(index === 0));
      tab.tabIndex = index === 0 ? 0 : -1;
      tab.dataset.caseIndex = String(index);
      tab.innerHTML = `<span class="case-tab-index">${String(index + 1).padStart(2, "0")}</span><strong>${item.title}</strong>`;
      tab.addEventListener("click", () => renderCase(index));
      tab.addEventListener("keydown", (event) => {
        let next = null;
        if (event.key === "ArrowDown" || event.key === "ArrowRight") next = activeCase + 1;
        else if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = activeCase - 1;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = caseData.length - 1;
        if (next !== null) { event.preventDefault(); renderCase(next, true); }
      });
      caseTabs.append(tab);
    });
    caseDetail.setAttribute("aria-labelledby", `case-tab-${caseData[0].id}`);
    syncCaseTabsOrientation();
    caseMobileQuery.addEventListener?.("change", syncCaseTabsOrientation);
    bindCaseSwipe();
  }

  /* Ecological cooperation cases: horizontal text tabs, no swipe carousel. */
  const cooperationData = window.HomeCooperationCases || [];
  const cooperationTabs = document.querySelector("[data-cooperation-tabs]");
  const cooperationCase = document.querySelector("[data-cooperation-case]");
  let activeCooperation = 0;
  let renderedCooperation = false;
  let cooperationMotionTimer = 0;

  function escapeCooperationText(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderCooperationPicture(item) {
    const source = escapeCooperationText(String(item.image || ""));
    const sizes = "(max-width: 767px) calc(100vw - 40px), 720px";
    const safeAlt = escapeCooperationText(item.imageAlt);
    const width = Number(item.imageWidth) || 1024;
    const height = Number(item.imageHeight) || 642;
    return `<picture><img src="${source}" sizes="${sizes}" alt="${safeAlt}" width="${width}" height="${height}" loading="lazy" decoding="async"></picture>`;
  }

  function renderCooperationCase(index, focusTab = false) {
    if (!cooperationData.length || !cooperationCase || !cooperationTabs) return;
    const nextCooperation = (index + cooperationData.length) % cooperationData.length;
    if (renderedCooperation && nextCooperation === activeCooperation) {
      if (focusTab) cooperationTabs.querySelector(".cooperation-tab.is-active")?.focus();
      return;
    }
    const isSwitching = renderedCooperation && nextCooperation !== activeCooperation && !reducedMotion.matches;
    window.clearTimeout(cooperationMotionTimer);
    cooperationCase.classList.remove("is-switching");
    activeCooperation = nextCooperation;
    const item = cooperationData[activeCooperation];
    cooperationTabs.querySelectorAll(".cooperation-tab").forEach((tab, tabIndex) => {
      const active = tabIndex === activeCooperation;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active) cooperationCase.setAttribute("aria-labelledby", tab.id);
      if (active && focusTab) tab.focus();
    });
    const lines = item.titleLines || [];
    const kicker = lines[0] ? `<span class="cooperation-case-kicker">${escapeCooperationText(lines[0])}</span>` : "";
    const displayTitle = escapeCooperationText(lines[1] || lines[0] || "");
    const titleHtml = `${kicker}${lines[1] ? displayTitle : ""}`;
    const tagsHtml = (item.tags || []).map((tag) => `<li>${escapeCooperationText(tag)}</li>`).join("");
    const featuresHtml = (item.features || []).map((feature) => {
      const iconSrc = feature.iconDark && currentTheme() === "dark" ? feature.iconDark : feature.icon;
      const iconThemeAttrs = feature.icon
        ? ` data-theme-src-light="${escapeCooperationText(feature.icon)}"${feature.iconDark ? ` data-theme-src-dark="${escapeCooperationText(feature.iconDark)}"` : ""}`
        : "";
      const icon = iconSrc
        ? `<img src="${escapeCooperationText(iconSrc)}"${iconThemeAttrs} alt="" width="24" height="24">`
        : "";
      return `<li><span class="cooperation-feature-icon" aria-hidden="true">${icon}</span><div><strong>${escapeCooperationText(feature.title)}</strong><p>${escapeCooperationText(feature.description)}</p></div></li>`;
    }).join("");
    const hideNames = Boolean(item.hideOrgNames) || !(item.orgName || item.orgNameEn);
    const logoWide = Boolean(item.logoWide) || hideNames;
    const logoClass = `cooperation-case-org-logo${logoWide ? " is-wide" : ""}`;
    const logoDark = item.logoDark
      ? ` data-theme-src-light="${escapeCooperationText(item.logo)}" data-theme-src-dark="${escapeCooperationText(item.logoDark)}"`
      : "";
    const logoSrc = item.logoDark && currentTheme() === "dark" ? item.logoDark : item.logo;
    const logoAlt = hideNames ? escapeCooperationText(item.tabLabel || item.orgName || "") : "";
    const logoWidth = Number(item.logoWidth) || (logoWide ? 220 : 36);
    const logoHeight = Number(item.logoHeight) || (logoWide ? 48 : 36);
    const logoMax = logoWide ? ` style="--logo-w: ${logoWidth}px; --logo-h: ${logoHeight}px"` : "";
    const namesHtml = hideNames
      ? ""
      : `<div class="cooperation-case-org-names">${item.orgName ? `<strong>${escapeCooperationText(item.orgName)}</strong>` : ""}${item.orgNameEn ? `<span>${escapeCooperationText(item.orgNameEn)}</span>` : ""}</div>`;
    const orgHtml = item.logo
      ? `<div class="cooperation-case-org"><img class="${logoClass}" src="${escapeCooperationText(logoSrc)}"${logoDark} alt="${logoAlt}" width="${logoWidth}" height="${logoHeight}"${logoMax}>${namesHtml}</div>`
      : "";
    const mediaClass = `cooperation-case-media${item.imageStroke ? " has-stroke" : ""}`;
    cooperationCase.innerHTML = `<div class="cooperation-case-copy">${orgHtml}<div class="cooperation-case-intro"><h3>${titleHtml}</h3><p>${escapeCooperationText(item.body)}</p><ul class="cooperation-case-tags">${tagsHtml}</ul></div><ul class="cooperation-case-features">${featuresHtml}</ul></div><div class="${mediaClass}">${renderCooperationPicture(item)}</div>`;
    renderedCooperation = true;
    if (isSwitching) {
      cooperationCase.classList.add("is-switching");
      cooperationMotionTimer = window.setTimeout(() => cooperationCase.classList.remove("is-switching"), 820);
    }
  }

  if (cooperationTabs && cooperationCase && cooperationData.length) {
    cooperationCase.id ||= "cooperation-case-panel";
    cooperationCase.setAttribute("role", "tabpanel");
    cooperationData.forEach((item, index) => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = `cooperation-tab${index === 0 ? " is-active" : ""}`;
      tab.id = `cooperation-tab-${item.id}`;
      tab.role = "tab";
      tab.setAttribute("aria-controls", cooperationCase.id);
      tab.setAttribute("aria-selected", String(index === 0));
      tab.tabIndex = index === 0 ? 0 : -1;
      tab.textContent = item.tabLabel;
      tab.addEventListener("click", () => renderCooperationCase(index));
      tab.addEventListener("keydown", (event) => {
        let next = null;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") next = activeCooperation + 1;
        else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = activeCooperation - 1;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = cooperationData.length - 1;
        if (next !== null) { event.preventDefault(); renderCooperationCase(next, true); }
      });
      cooperationTabs.append(tab);
    });
    cooperationCase.setAttribute("aria-labelledby", `cooperation-tab-${cooperationData[0].id}`);
    renderCooperationCase(0);
  }

  const localCooperationDialog = document.getElementById("home-local-cooperation-dialog");
  const localCooperationForm = localCooperationDialog?.querySelector("[data-local-cooperation-form]");
  const localCooperationToast = document.getElementById("home-local-cooperation-toast");
  let lastLocalDialogTrigger = null;
  let localToastTimer = 0;
  const successToastIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M8 12.5 L11 15.5 L16 9.5"></path></svg>';

  function showLocalToast(message) {
    if (!localCooperationToast) return;
    localCooperationToast.className = "app-toast success";
    localCooperationToast.setAttribute("role", "status");
    localCooperationToast.innerHTML = `<span class="app-toast-ico">${successToastIcon}</span><span class="app-toast-msg"></span>`;
    localCooperationToast.querySelector(".app-toast-msg").textContent = String(message || "");
    window.clearTimeout(localToastTimer);
    window.requestAnimationFrame(() => localCooperationToast.classList.add("show"));
    localToastTimer = window.setTimeout(() => localCooperationToast.classList.remove("show"), 1800);
  }

  function openStandaloneCooperationDialog(trigger) {
    if (!localCooperationDialog || localCooperationDialog.open) return;
    lastLocalDialogTrigger = trigger || document.activeElement;
    localCooperationDialog.showModal();
    document.body.classList.add("has-open-dialog");
    window.setTimeout(() => localCooperationDialog.querySelector("input, textarea, button")?.focus(), 0);
  }

  function closeStandaloneCooperationDialog() {
    if (!localCooperationDialog?.open) return;
    localCooperationDialog.close();
    document.body.classList.remove("has-open-dialog");
    if (lastLocalDialogTrigger instanceof HTMLElement) lastLocalDialogTrigger.focus();
    lastLocalDialogTrigger = null;
  }

  function setLocalResearchDirection(chip) {
    const group = chip.closest('[role="radiogroup"]');
    group?.querySelectorAll('[role="radio"]').forEach((item) => {
      const selected = item === chip;
      item.classList.toggle("is-active", selected);
      item.setAttribute("aria-checked", String(selected));
      item.tabIndex = selected ? 0 : -1;
    });
    const error = localCooperationForm?.querySelector("[data-local-form-error]");
    if (error) error.textContent = "";
  }

  function validateLocalCooperationForm() {
    if (!localCooperationForm) return false;
    let valid = true;
    localCooperationForm.querySelectorAll("[required]").forEach((field) => {
      if (field.type === "checkbox" || field.type === "radio") return;
      const invalid = !field.value.trim();
      field.classList.toggle("is-error", invalid);
      field.setAttribute("aria-invalid", String(invalid));
      valid = valid && !invalid;
    });
    const research = localCooperationForm.querySelector('[role="radiogroup"] [aria-checked="true"]');
    const methods = localCooperationForm.querySelectorAll('input[name="cooperationMethod"]:checked');
    const methodField = localCooperationForm.querySelector("[data-local-method-field]");
    methodField?.classList.toggle("is-error", methods.length === 0);
    methodField?.setAttribute("aria-invalid", String(methods.length === 0));
    valid = valid && Boolean(research) && methods.length > 0;
    const error = localCooperationForm.querySelector("[data-local-form-error]");
    if (error) error.textContent = valid ? "" : "请补全所有必填字段";
    return valid;
  }

  localCooperationDialog?.addEventListener("click", (event) => {
    if (event.target.closest("[data-local-dialog-close]") || event.target === localCooperationDialog) {
      closeStandaloneCooperationDialog();
      return;
    }
    const chip = event.target.closest('[role="radiogroup"] [role="radio"]');
    if (chip) setLocalResearchDirection(chip);
  });

  localCooperationDialog?.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeStandaloneCooperationDialog();
  });

  localCooperationForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!validateLocalCooperationForm()) return;
    closeStandaloneCooperationDialog();
    showLocalToast("提交成功");
  });

  localCooperationForm?.addEventListener("input", (event) => {
    const field = event.target;
    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
      field.classList.remove("is-error");
      field.removeAttribute("aria-invalid");
    }
    if (field instanceof HTMLInputElement && field.name === "cooperationMethod") {
      const methodField = localCooperationForm.querySelector("[data-local-method-field]");
      methodField?.classList.remove("is-error");
      methodField?.removeAttribute("aria-invalid");
    }
    const error = localCooperationForm.querySelector("[data-local-form-error]");
    if (error) error.textContent = "";
  });

  localCooperationDialog?.addEventListener("keydown", (event) => {
    const radio = event.target.closest?.('[role="radiogroup"] [role="radio"]');
    if (!radio || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    const radios = Array.from(radio.closest('[role="radiogroup"]').querySelectorAll('[role="radio"]'));
    const currentIndex = radios.indexOf(radio);
    let nextIndex = currentIndex;
    if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = radios.length - 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (currentIndex - 1 + radios.length) % radios.length;
    else nextIndex = (currentIndex + 1) % radios.length;
    event.preventDefault();
    setLocalResearchDirection(radios[nextIndex]);
    radios[nextIndex].focus();
  });
  /* SCP-Lab 申请使用弹窗（静态邮件申请提示）。 */
  const localScpLabDialog = document.getElementById("home-local-scp-lab-dialog");
  let lastScpLabApplyTrigger = null;
  let scpLabApplyRequestId = "";
  let scpLabApplyRetryTimer = 0;

  function copyTextWithFallback(text, onDone) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(onDone).catch(() => legacyCopyText(text, onDone));
    } else {
      legacyCopyText(text, onDone);
    }
  }

  function legacyCopyText(text, onDone) {
    const helper = document.createElement("textarea");
    helper.value = text;
    helper.setAttribute("readonly", "");
    helper.style.position = "fixed";
    helper.style.opacity = "0";
    document.body.appendChild(helper);
    helper.select();
    try {
      document.execCommand("copy");
      onDone();
    } catch (error) {
      console.info("[discovery-home] 复制失败：", error);
    }
    helper.remove();
  }

  const activeScpLabToasts = [];

  function layoutScpLabToasts() {
    let offset = 0;
    activeScpLabToasts.forEach((item) => {
      item._slotOffset = offset;
      item.style.transform = `translate(-50%, ${offset}px)`;
      offset += item.offsetHeight + 8;
    });
  }

  function dismissScpLabToast(item) {
    const index = activeScpLabToasts.indexOf(item);
    if (index < 0) return;
    activeScpLabToasts.splice(index, 1);
    window.clearTimeout(item._toastTimer);
    item.classList.remove("show");
    item.style.transform = `translate(-50%, ${(item._slotOffset || 0) - 14}px)`;
    window.setTimeout(() => item.remove(), 240);
    layoutScpLabToasts();
  }

  /* 多条 toast 在弹窗所在层纵向堆叠：新的在最上方，未消失的顺势下移。 */
  function showScpLabLocalToast(message) {
    if (!localScpLabDialog) return;
    const item = document.createElement("div");
    item.className = "app-toast success";
    item.setAttribute("role", "status");
    item.innerHTML = `<span class="app-toast-ico">${successToastIcon}</span><span class="app-toast-msg"></span>`;
    item.querySelector(".app-toast-msg").textContent = String(message || "");
    localScpLabDialog.appendChild(item);
    activeScpLabToasts.unshift(item);
    item._slotOffset = 0;
    item.style.transform = "translate(-50%, -14px)";
    window.requestAnimationFrame(() => {
      item.classList.add("show");
      layoutScpLabToasts();
    });
    item._toastTimer = window.setTimeout(() => dismissScpLabToast(item), 1800);
  }

  function copyLocalScpLabPart(button) {
    const part = button.closest(".scplab-template-part");
    const text = part?.querySelector("[data-scp-lab-text]")?.textContent || "";
    if (!text.trim()) return;
    const label = part.querySelector(".scplab-part-label")?.textContent.trim() || "内容";
    copyTextWithFallback(text, () => showScpLabLocalToast("已复制" + label));
  }

  function requestShellScpLabDialog(trigger) {
    lastScpLabApplyTrigger = trigger;
    const requestId = "scplab-open-" + Date.now();
    const request = { type: "home:scplab-dialog:open", requestId: requestId };
    scpLabApplyRequestId = requestId;
    window.clearTimeout(scpLabApplyRetryTimer);
    postToShell(request);
    scpLabApplyRetryTimer = window.setTimeout(() => {
      if (scpLabApplyRequestId === requestId) postToShell(request);
    }, 300);
  }

  function openStandaloneScpLabDialog(trigger) {
    if (!localScpLabDialog || localScpLabDialog.open) return;
    lastScpLabApplyTrigger = trigger || document.activeElement;
    localScpLabDialog.showModal();
    document.body.classList.add("has-open-dialog");
    window.setTimeout(() => localScpLabDialog.querySelector("input, textarea, button")?.focus(), 0);
  }

  function closeStandaloneScpLabDialog() {
    if (!localScpLabDialog?.open) return;
    localScpLabDialog.close();
    document.body.classList.remove("has-open-dialog");
    activeScpLabToasts.splice(0).forEach((item) => {
      window.clearTimeout(item._toastTimer);
      item.remove();
    });
    if (lastScpLabApplyTrigger instanceof HTMLElement) lastScpLabApplyTrigger.focus();
    lastScpLabApplyTrigger = null;
  }

  localScpLabDialog?.addEventListener("click", (event) => {
    if (event.target.closest("[data-scp-lab-copy]")) {
      copyLocalScpLabPart(event.target.closest("[data-scp-lab-copy]"));
      return;
    }
    if (event.target.closest("[data-local-scp-lab-dialog-close]") || event.target === localScpLabDialog) {
      closeStandaloneScpLabDialog();
    }
  });

  localScpLabDialog?.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeStandaloneScpLabDialog();
  });
})();
