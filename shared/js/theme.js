(function () {
  "use strict";

  var storageKey = "interninkstone-theme";
  var legacyStorageKey = "interninkstone-design-system-theme";
  var root = document.documentElement;
  var darkPreference = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  function normalizeTheme(theme) {
    return theme === "light" || theme === "dark" ? theme : null;
  }

  function readStorage(key) {
    try {
      return normalizeTheme(window.localStorage.getItem(key));
    } catch (error) {
      return null;
    }
  }

  function readStoredTheme() {
    var storedTheme = readStorage(storageKey);
    var legacyTheme;

    if (storedTheme) return storedTheme;

    legacyTheme = readStorage(legacyStorageKey);
    if (legacyTheme) writeStoredTheme(legacyTheme);
    return legacyTheme;
  }

  function writeStoredTheme(theme) {
    try {
      window.localStorage.setItem(storageKey, theme);
    } catch (error) {
      // The selected theme still applies to the current document.
    }
  }

  function preferredTheme() {
    return readStoredTheme() || (darkPreference && darkPreference.matches ? "dark" : "light");
  }

  function updateControls(theme) {
    var isDark = theme === "dark";

    document.querySelectorAll("[data-theme-toggle]").forEach(function (control) {
      control.setAttribute("aria-checked", String(isDark));
    });

    document.querySelectorAll("[data-theme-option]").forEach(function (control) {
      control.setAttribute("aria-pressed", String(control.getAttribute("data-theme-option") === theme));
    });
  }

  function updateThemeImages(theme) {
    document.querySelectorAll("[data-theme-src-light], [data-theme-src-dark]").forEach(function (image) {
      var lightSource = image.getAttribute("data-theme-src-light");
      var darkSource = image.getAttribute("data-theme-src-dark");
      var nextSource = theme === "dark" && darkSource ? darkSource : lightSource;

      if (nextSource && image.getAttribute("src") !== nextSource) image.setAttribute("src", nextSource);
    });

    document.querySelectorAll("[data-theme-srcset-light], [data-theme-srcset-dark]").forEach(function (source) {
      var lightSourceSet = source.getAttribute("data-theme-srcset-light");
      var darkSourceSet = source.getAttribute("data-theme-srcset-dark");
      var nextSourceSet = theme === "dark" && darkSourceSet ? darkSourceSet : lightSourceSet;

      if (nextSourceSet && source.getAttribute("srcset") !== nextSourceSet) source.setAttribute("srcset", nextSourceSet);
    });
  }

  function applyTheme(theme, announce) {
    var nextTheme = normalizeTheme(theme) || preferredTheme();

    root.setAttribute("data-theme", nextTheme);
    updateControls(nextTheme);
    updateThemeImages(nextTheme);

    if (announce !== false) {
      document.dispatchEvent(new CustomEvent("inkstone:themechange", { detail: { theme: nextTheme } }));
    }

    return nextTheme;
  }

  function setTheme(theme) {
    var nextTheme = normalizeTheme(theme);

    if (!nextTheme) return root.getAttribute("data-theme");
    writeStoredTheme(nextTheme);
    return applyTheme(nextTheme);
  }

  function initializeControls() {
    document.querySelectorAll("[data-theme-toggle]").forEach(function (control) {
      if (control.getAttribute("data-theme-bound") === "true") return;
      control.setAttribute("data-theme-bound", "true");
      control.addEventListener("click", function () {
        setTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark");
      });
    });

    document.querySelectorAll("[data-theme-option]").forEach(function (control) {
      if (control.getAttribute("data-theme-bound") === "true") return;
      control.setAttribute("data-theme-bound", "true");
      control.addEventListener("click", function () {
        setTheme(control.getAttribute("data-theme-option"));
      });
    });

    applyTheme(root.getAttribute("data-theme"), false);
  }

  root.classList.add("js");
  applyTheme(preferredTheme(), false);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeControls, { once: true });
  } else {
    initializeControls();
  }

  if (darkPreference) {
    var handleSystemThemeChange = function (event) {
      if (!readStoredTheme()) applyTheme(event.matches ? "dark" : "light");
    };

    if (darkPreference.addEventListener) {
      darkPreference.addEventListener("change", handleSystemThemeChange);
    } else if (darkPreference.addListener) {
      darkPreference.addListener(handleSystemThemeChange);
    }
  }

  window.addEventListener("storage", function (event) {
    if (event.key === storageKey || event.key === legacyStorageKey) applyTheme(preferredTheme());
  });

  window.InkstoneTheme = {
    getTheme: function () { return root.getAttribute("data-theme"); },
    setTheme: setTheme
  };
}());
