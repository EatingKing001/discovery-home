(function () {
  "use strict";

  var storageKey = "interninkstone-design-system-theme";
  var darkPreference = window.matchMedia("(prefers-color-scheme: dark)");
  var root = document.documentElement;

  function readStoredTheme() {
    try {
      var storedTheme = window.localStorage.getItem(storageKey);
      return storedTheme === "light" || storedTheme === "dark" ? storedTheme : null;
    } catch (error) {
      return null;
    }
  }

  function writeStoredTheme(theme) {
    try {
      window.localStorage.setItem(storageKey, theme);
    } catch (error) {
      // The selected theme still applies for this page when storage is unavailable.
    }
  }

  function preferredTheme() {
    return readStoredTheme() || (darkPreference.matches ? "dark" : "light");
  }

  function updateControls(theme) {
    var isDark = theme === "dark";

    document.querySelectorAll("[data-theme-toggle]").forEach(function (control) {
      control.setAttribute("aria-checked", String(isDark));
    });
  }

  function applyTheme(theme) {
    root.dataset.theme = theme;
    updateControls(theme);
  }

  root.classList.add("js");
  applyTheme(preferredTheme());

  function initializeControls() {
    document.querySelectorAll("[data-theme-toggle]").forEach(function (control) {
      control.addEventListener("click", function () {
        var nextTheme = root.dataset.theme === "dark" ? "light" : "dark";
        writeStoredTheme(nextTheme);
        applyTheme(nextTheme);
      });
    });

    updateControls(root.dataset.theme);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeControls, { once: true });
  } else {
    initializeControls();
  }

  darkPreference.addEventListener("change", function (event) {
    if (!readStoredTheme()) {
      applyTheme(event.matches ? "dark" : "light");
    }
  });

  window.addEventListener("storage", function (event) {
    if (event.key === storageKey) {
      applyTheme(preferredTheme());
    }
  });
}());
