(function () {
  "use strict";

  const successIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M8 12.5 L11 15.5 L16 9.5"></path></svg>';
  const warningIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v6"></path><circle cx="12" cy="16" r="1" fill="currentColor" stroke="none"></circle></svg>';
  const errorIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M8 8l8 8M16 8l-8 8"></path></svg>';
  let toastTimer = 0;

  function toastEl() {
    return document.getElementById("shell-toast") || document.getElementById("home-local-cooperation-toast");
  }

  function showToast(message, variant) {
    const toast = toastEl();
    if (!toast) return;
    const kind = variant === "error" ? "error" : variant === "warning" ? "warning" : "success";
    const icon = kind === "error" ? errorIcon : kind === "warning" ? warningIcon : successIcon;
    toast.className = `app-toast ${kind}`;
    toast.setAttribute("role", "status");
    toast.innerHTML = `<span class="app-toast-ico">${icon}</span><span class="app-toast-msg"></span>`;
    toast.querySelector(".app-toast-msg").textContent = String(message || "");
    window.clearTimeout(toastTimer);
    window.requestAnimationFrame(() => toast.classList.add("show"));
    toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function methodFieldSelector(form) {
    if (form.hasAttribute("data-local-cooperation-form")) return "[data-local-method-field]";
    return "[data-method-field]";
  }

  function errorSelector(form) {
    if (form.hasAttribute("data-local-cooperation-form")) return "[data-local-form-error]";
    return "[data-form-error]";
  }

  function validateForm(form) {
    if (!form) return false;
    let valid = true;
    form.querySelectorAll("[required]").forEach((field) => {
      if (field.type === "checkbox" || field.type === "radio") return;
      const invalid = !field.value.trim();
      field.classList.toggle("is-error", invalid);
      field.setAttribute("aria-invalid", String(invalid));
      valid = valid && !invalid;
    });
    const research = form.querySelector('[role="radiogroup"] [aria-checked="true"]');
    const methods = form.querySelectorAll('input[name="cooperationMethod"]:checked');
    const methodField = form.querySelector(methodFieldSelector(form));
    methodField?.classList.toggle("is-error", methods.length === 0);
    methodField?.setAttribute("aria-invalid", String(methods.length === 0));
    valid = valid && Boolean(research) && methods.length > 0;
    const error = form.querySelector(errorSelector(form));
    if (error) error.textContent = valid ? "" : "请补全所有必填字段";
    return valid;
  }

  function collectPayload(form) {
    const research = form.querySelector('[role="radiogroup"] [aria-checked="true"]')?.textContent.trim() || "";
    return {
      name: form.elements.name?.value.trim() || "",
      phone: form.elements.phone?.value.trim() || "",
      organization: form.elements.organization?.value.trim() || "",
      position: form.elements.position?.value.trim() || "",
      researchDirection: research,
      researchContent: form.elements.researchContent?.value.trim() || "",
      cooperationMethods: Array.from(form.querySelectorAll('input[name="cooperationMethod"]:checked')).map((item) => item.value),
      cooperationContent: form.elements.cooperationContent?.value.trim() || ""
    };
  }

  function closeFormUi(form) {
    if (form.hasAttribute("data-cooperation-form")) {
      document.querySelector("#cooperation-dialog [data-dialog-close]")?.click();
      return;
    }
    if (form.hasAttribute("data-local-cooperation-form")) {
      form.closest("dialog")?.querySelector("[data-local-dialog-close]")?.click();
    }
  }

  async function postCooperation(payload) {
    const url = String(window.SiteLinkConfig?.cooperationSubmitUrl || "").trim();
    if (!url) {
      console.info("[discovery-home] cooperationSubmitUrl 未配置，表单数据如下（未上报）：", payload);
      return { status: "unconfigured" };
    }
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
    }
    return { status: "ok" };
  }

  function bindForm(form) {
    if (!form || form.dataset.businessSubmitBound === "1") return;
    form.dataset.businessSubmitBound = "1";

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!validateForm(form)) return;

      const payload = collectPayload(form);
      const submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      Promise.resolve(postCooperation(payload))
        .then((result) => {
          if (result.status === "unconfigured") {
            showToast("提交通道未配置", "warning");
            return;
          }
          closeFormUi(form);
          showToast("提交成功", "success");
        })
        .catch((error) => {
          console.error("[discovery-home] 合作申请提交失败：", error, payload);
          showToast("提交失败，请稍后重试", "error");
        })
        .finally(() => {
          if (submitBtn) submitBtn.disabled = false;
        });
    }, true);
  }

  function init() {
    bindForm(document.querySelector("[data-cooperation-form]"));
    bindForm(document.querySelector("[data-local-cooperation-form]"));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
