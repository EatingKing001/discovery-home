/**
 * 官网渠道参数捕获与产品站 URL 透传。
 * 产品站进 SSO 时需自行继续透传本组参数（本仓不覆盖产品站）。
 */
(function () {
  "use strict";

  var STORAGE_KEY = "discovery-home:channel-track";
  var CHANNEL_KEYS = [
    "utm_campaign",
    "utm_source",
    "utm_medium",
    "utm_term",
    "utm_content",
    "_channel_track_key"
  ];

  function readStorage() {
    try {
      var raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function writeStorage(data) {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_) { /* private mode / quota */ }
  }

  function extractFromSearch(search) {
    var out = {};
    var params;
    try {
      params = new URLSearchParams(search || "");
    } catch (_) {
      return out;
    }
    for (var i = 0; i < CHANNEL_KEYS.length; i++) {
      var key = CHANNEL_KEYS[i];
      if (!params.has(key)) continue;
      var value = String(params.get(key) || "").trim();
      if (value) out[key] = value;
    }
    return out;
  }

  /**
   * 从 location 提取非空渠道参数写入 sessionStorage。
   * 本次 URL 无渠道参数时沿用已有存储（同一会话持续）。
   */
  function captureFrom(loc) {
    if (!loc) return getStored();
    var found = extractFromSearch(loc.search);
    var keys = Object.keys(found);
    if (!keys.length) return getStored();
    var next = Object.assign({}, readStorage(), found);
    writeStorage(next);
    return next;
  }

  function getStored() {
    var stored = readStorage();
    var out = {};
    for (var i = 0; i < CHANNEL_KEYS.length; i++) {
      var key = CHANNEL_KEYS[i];
      var value = stored[key];
      if (value != null && String(value).trim()) out[key] = String(value).trim();
    }
    return out;
  }

  /**
   * 将存储的渠道参数 merge 进产品站 URL（保留 base 的 hash/query；渠道 key 以存储为准）。
   */
  function appendToUrl(baseUrl) {
    var stored = getStored();
    var keys = Object.keys(stored);
    if (!keys.length) return String(baseUrl || "");
    try {
      var url = new URL(String(baseUrl || ""), window.location.href);
      for (var i = 0; i < CHANNEL_KEYS.length; i++) {
        var key = CHANNEL_KEYS[i];
        if (Object.prototype.hasOwnProperty.call(stored, key)) {
          url.searchParams.set(key, stored[key]);
        }
      }
      return url.toString();
    } catch (_) {
      return String(baseUrl || "");
    }
  }

  function captureBestEffort() {
    captureFrom(window.location);
    try {
      if (window.top && window.top !== window) captureFrom(window.top.location);
    } catch (_) { /* cross-origin */ }
  }

  captureBestEffort();

  window.DiscoveryChannelTrack = {
    CHANNEL_KEYS: CHANNEL_KEYS.slice(),
    STORAGE_KEY: STORAGE_KEY,
    captureFrom: captureFrom,
    getStored: getStored,
    appendToUrl: appendToUrl
  };
})();
