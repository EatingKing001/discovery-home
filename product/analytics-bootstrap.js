/**
 * @migo/analytics bootstrap for shell + Home (iframe / standalone).
 *
 * - Shell / standalone Home: full init → Sensors auto $pageview (PV/UV)
 * - Home iframe (?embedded=1 or parent!==self): init with startAutoTrack no-op → clicks only, no second $pageview
 *
 * 建议值已采用，请产品确认：
 * - app_id: discovery-home-new-fe（CI SERVICE_NAME）
 * - biz: science-discovery（复用 discovery-host-fe SensorsBuried）
 * - client_type: Web
 */
(function () {
  "use strict";

  var PROD_HOST = "discovery-home.intern-ai.org.cn";
  var APP_ID = "discovery-home-new-fe";
  var BIZ = "science-discovery";
  var CLIENT_TYPE = "Web";

  function isDevHost() {
    return String(location.hostname || "").toLowerCase() !== PROD_HOST;
  }

  function isEmbeddedHome() {
    try {
      if (new URLSearchParams(location.search).has("embedded")) return true;
    } catch (_) { /* ignore */ }
    try {
      return window.parent !== window;
    } catch (_) {
      return true;
    }
  }

  var api = window.MigoAnalytics;
  if (!api || typeof api.bootstrapSensorsAnalytics !== "function") {
    console.info("[discovery-home] MigoAnalytics UMD missing; skip analytics bootstrap");
    return;
  }

  var sensors = {
    isDev: isDevHost(),
    pageProperties: {
      biz: BIZ,
      client_type: CLIENT_TYPE
    }
  };

  var channelProps =
    window.DiscoveryChannelTrack && typeof window.DiscoveryChannelTrack.getStored === "function"
      ? window.DiscoveryChannelTrack.getStored()
      : {};

  var common = {
    identity: { status: "resolving" },
    commonProperties: Object.assign({ app_id: APP_ID }, channelProps)
  };

  var analytics;
  var embedded = isEmbeddedHome();

  if (embedded && typeof api.createSensorsTransport === "function" && typeof api.bootstrapAnalytics === "function") {
    // Prefer API path that disables auto $pageview (no public flag on bootstrapSensorsAnalytics).
    var transport = api.createSensorsTransport(sensors);
    transport.startAutoTrack = function () { /* embedded Home: shell owns PV */ };
    analytics = api.bootstrapAnalytics({
      identity: common.identity,
      commonProperties: common.commonProperties,
      transport: transport
    });
  } else {
    analytics = api.bootstrapSensorsAnalytics({
      identity: common.identity,
      commonProperties: common.commonProperties,
      sensors: sensors
    });
  }

  // No login on this site → resolve as anonymous (Sensors distinct_id).
  analytics.setIdentity({ resolving: false, userId: null });
  window.DiscoveryAnalytics = analytics;

  /**
   * Web download card needs two metrics on one click; DOM collector supports one event name per node.
   */
  function bindWebDownloadDualTrack() {
    if (document.documentElement.dataset.analyticsWebDownloadBound === "1") return;
    document.documentElement.dataset.analyticsWebDownloadBound = "1";

    document.addEventListener(
      "click",
      function (event) {
        var card = event.target && event.target.closest
          ? event.target.closest("a.download-card[data-discovery-link]")
          : null;
        if (!card || !window.DiscoveryAnalytics) return;
        window.DiscoveryAnalytics.track("online_use_click", { entry: "downloads_web" });
        window.DiscoveryAnalytics.track("download_click", { version: "web" });
      },
      true
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindWebDownloadDualTrack);
  } else {
    bindWebDownloadDualTrack();
  }
})();
