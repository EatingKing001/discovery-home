(function () {
  "use strict";

  /**
   * MVSP 科学问题提交（「提交问题」弹窗，shell 与 Home 本地弹窗共用）。
   * - 逐字段校验 + 条件必填（专项→关联项目、L2/L3→实验验证条件、材料待补充→缺失项）。
   * - 任务包 ZIP 为模拟上传（进度动画，无真实后端）。
   * - 草稿用 sessionStorage 暂存：关闭弹窗/刷新页面保留，关闭标签页即清空。
   * - 提交 API 未配置时不假成功：console 打印 payload + toast 提示。
   */

  const DRAFT_KEY = "mvsp-proposal-draft";

  const successIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M8 12.5 L11 15.5 L16 9.5"></path></svg>';
  const warningIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v6"></path><circle cx="12" cy="16" r="1" fill="currentColor" stroke="none"></circle></svg>';
  const errorIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M8 8l8 8M16 8l-8 8"></path></svg>';
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

  /* ---------- 草稿暂存（sessionStorage：标签页关闭即清空） ---------- */

  function readDraft() {
    try {
      const raw = window.sessionStorage.getItem(DRAFT_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      return {};
    }
  }

  function writeDraft(form) {
    const data = {};
    form.querySelectorAll("input[name], textarea[name]").forEach((field) => {
      if (field.type === "file") return;
      if (field.type === "checkbox") {
        if (!Array.isArray(data[field.name])) data[field.name] = [];
        if (field.checked) data[field.name].push(field.value);
      } else if (field.type === "radio") {
        if (field.checked) data[field.name] = field.value;
      } else {
        data[field.name] = field.value;
      }
    });
    const upload = form.querySelector("[data-mvsp-upload]");
    if (upload?.dataset.uploadedName) data.__uploadName = upload.dataset.uploadedName;
    try {
      window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    } catch (error) {
      /* 存储不可用时静默跳过，不影响表单使用 */
    }
  }

  function restoreDraft(form) {
    const data = readDraft();
    form.querySelectorAll("input[name], textarea[name]").forEach((field) => {
      if (field.type === "file") return;
      const saved = data[field.name];
      if (saved === undefined) return;
      if (field.type === "checkbox") field.checked = Array.isArray(saved) ? saved.includes(field.value) : Boolean(saved);
      else if (field.type === "radio") field.checked = saved === field.value;
      else if (typeof saved === "string") field.value = saved;
    });
    if (data.__uploadName) markUploaded(form, data.__uploadName, true);
    syncConditionalFields(form);
  }

  /* ---------- 条件必填与条件展示 ---------- */

  function syncConditionalFields(form) {
    const contexts = Array.from(form.querySelectorAll('input[name="cooperationContext"]:checked')).map((item) => item.value);

    const isSpecial = contexts.includes("科学智能体专项");
    const projectInput = form.querySelector('[name="relatedProject"]');
    const condStar = form.querySelector("[data-mvsp-cond-star]");
    const condTag = form.querySelector("[data-mvsp-cond-tag]");
    if (projectInput) projectInput.required = isSpecial;
    if (condStar) condStar.hidden = !isSpecial;
    if (condTag) condTag.hidden = isSpecial;

    const otherChecked = contexts.includes("其他");
    const otherWrap = form.querySelector("[data-mvsp-other-wrap]");
    const otherInput = otherWrap?.querySelector("input");
    if (otherWrap) otherWrap.hidden = !otherChecked;
    if (otherInput) otherInput.required = otherChecked;

    const level = form.querySelector('input[name="taskLevel"]:checked')?.value || "";
    const wetLab = level === "L2" || level === "L3";
    const expInput = form.querySelector('[name="expValidation"]');
    const expStar = form.querySelector("[data-mvsp-exp-star]");
    const expTag = form.querySelector("[data-mvsp-exp-tag]");
    if (expInput) expInput.required = wetLab;
    if (expStar) expStar.hidden = !wetLab;
    if (expTag) expTag.hidden = wetLab;

    const readiness = form.querySelector('input[name="packageReadiness"]:checked')?.value || "";
    const needGap = readiness === "部分材料待补充" || readiness === "需协助构建任务";
    const gapWrap = form.querySelector("[data-mvsp-gap-wrap]");
    const gapInput = gapWrap?.querySelector("input");
    if (gapWrap) gapWrap.hidden = !needGap;
    if (gapInput) gapInput.required = needGap;
  }

  /* ---------- 模拟上传 ---------- */

  /* 上传组件四态切换：idle / loading / done / failed。 */
  function setUploadState(wrap, state) {
    const states = { idle: "[data-mvsp-upload-btn]", loading: "[data-mvsp-progress]", done: "[data-mvsp-done]", failed: "[data-mvsp-failed]" };
    Object.entries(states).forEach(([key, selector]) => {
      const el = wrap.querySelector(selector);
      if (el) el.hidden = key !== state;
    });
    wrap.classList.toggle("is-error", state === "failed");
  }

  function markUploaded(form, name, restored) {
    const wrap = form.querySelector("[data-mvsp-upload]");
    if (!wrap) return;
    wrap.dataset.uploadedName = name;
    const nameEl = wrap.querySelector("[data-mvsp-file-name]");
    if (nameEl) nameEl.textContent = restored ? `${name}（本次会话已暂存）` : name;
    setUploadState(wrap, "done");
    setFieldError(form, "taskPackage", "");
  }

  function markUploadFailed(form, name, reason) {
    const wrap = form.querySelector("[data-mvsp-upload]");
    if (!wrap) return;
    wrap.dataset.uploadedName = "";
    const nameEl = wrap.querySelector("[data-mvsp-failed-name]");
    if (nameEl) nameEl.textContent = name || "文件上传失败";
    setUploadState(wrap, "failed");
    setFieldError(form, "taskPackage", reason || "");
  }

  function bindUpload(form) {
    const wrap = form.querySelector("[data-mvsp-upload]");
    if (!wrap || wrap.dataset.uploadBound === "1") return;
    wrap.dataset.uploadBound = "1";
    const input = wrap.querySelector("[data-mvsp-file]");
    const idle = wrap.querySelector("[data-mvsp-upload-btn]");
    const progressPct = wrap.querySelector("[data-mvsp-progress-pct]");
    const cancelBtn = wrap.querySelector("[data-mvsp-upload-cancel]");
    const resetBtn = wrap.querySelector("[data-mvsp-upload-reset]");
    const retryBtn = wrap.querySelector("[data-mvsp-upload-retry]");

    function stopUpload() {
      if (wrap._uploadTimer) {
        window.clearInterval(wrap._uploadTimer);
        wrap._uploadTimer = 0;
      }
    }

    function resetUpload() {
      stopUpload();
      wrap.dataset.uploadedName = "";
      if (input) input.value = "";
      setUploadState(wrap, "idle");
      setFieldError(form, "taskPackage", "");
      writeDraft(form);
    }

    function acceptFile(file) {
      if (!file) return;
      if (!/\.zip$/i.test(file.name)) {
        markUploadFailed(form, file.name, "仅支持 .zip 格式文件，请重新选择");
        return;
      }
      setUploadState(wrap, "loading");
      setFieldError(form, "taskPackage", "");
      let pct = 0;
      if (progressPct) progressPct.textContent = "0";
      wrap._uploadTimer = window.setInterval(() => {
        pct = Math.min(100, pct + Math.random() * 18 + 6);
        if (progressPct) progressPct.textContent = String(Math.round(pct));
        if (pct >= 100) {
          stopUpload();
          window.setTimeout(() => {
            markUploaded(form, file.name, false);
            writeDraft(form);
          }, 240);
        }
      }, 120);
    }

    /* 整个上传组件都是点击热区；完成/进度/失败态与动作按钮除外（按钮点击冒泡到此处统一处理）。 */
    wrap.addEventListener("click", (event) => {
      if (event.target.closest(".mvsp-upload-action")) return;
      if (!idle || idle.hidden) return;
      input?.click();
    });
    idle?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      input?.click();
    });
    input?.addEventListener("change", () => acceptFile(input.files?.[0]));
    wrap.addEventListener("dragover", (event) => {
      event.preventDefault();
      wrap.classList.add("is-dragover");
    });
    wrap.addEventListener("dragleave", () => wrap.classList.remove("is-dragover"));
    wrap.addEventListener("drop", (event) => {
      event.preventDefault();
      wrap.classList.remove("is-dragover");
      acceptFile(event.dataTransfer?.files?.[0]);
    });
    cancelBtn?.addEventListener("click", resetUpload);
    resetBtn?.addEventListener("click", resetUpload);
    retryBtn?.addEventListener("click", resetUpload);
  }

  /* ---------- 校验 ---------- */

  function setFieldError(form, key, message) {
    const el = form.querySelector(`[data-field-error="${key}"]`);
    if (el) el.textContent = message || "";
  }

  function fieldTitle(field) {
    const wrap = field.closest(".tm-field");
    const label = wrap?.querySelector(".tm-label");
    return label?.childNodes[0]?.textContent.trim() || "该字段";
  }

  function validateForm(form) {
    let valid = true;
    let firstInvalid = null;

    form.querySelectorAll("input[name]:not([type='checkbox']):not([type='radio']):not([type='file']), textarea[name]").forEach((field) => {
      if (field.closest("[hidden]")) return;
      const required = field.required || field.hasAttribute("required");
      let message = "";
      if (required && !field.value.trim()) message = `请输入${fieldTitle(field)}`;
      else if (field.type === "email" && field.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value.trim())) message = "请输入正确的邮箱地址";
      const invalid = Boolean(message);
      field.classList.toggle("is-error", invalid);
      field.setAttribute("aria-invalid", String(invalid));
      setFieldError(form, field.name, message);
      if (invalid) {
        valid = false;
        firstInvalid = firstInvalid || field;
      }
    });

    const groups = [
      ["cooperationContext", "请选择合作来源", 'input[name="cooperationContext"]:checked'],
      ["taskLevel", "请选择建议任务等级", 'input[name="taskLevel"]:checked'],
      ["harness", "请选择 Harness 要求", 'input[name="harness"]:checked'],
      ["packageReadiness", "请选择材料完备程度", 'input[name="packageReadiness"]:checked'],
      ["trainingConsent", "请选择训练与能力改进授权方式", 'input[name="trainingConsent"]:checked'],
      ["publishConsent", "请选择公开发布授权方式", 'input[name="publishConsent"]:checked'],
    ];
    groups.forEach(([key, message, selector]) => {
      const group = form.querySelector(`[data-mvsp-group="${key}"]`);
      const invalid = !form.querySelector(selector);
      group?.classList.toggle("is-error", invalid);
      setFieldError(form, key, invalid ? message : "");
      if (invalid) {
        valid = false;
        firstInvalid = firstInvalid || group;
      }
    });

    const confirmBoxes = ["confirmRights", "confirmUsage"];
    const allConfirmed = confirmBoxes.every((name) => form.querySelector(`input[name="${name}"]`)?.checked);
    const confirmGroup = form.querySelector('[data-mvsp-group="confirms"]');
    confirmGroup?.classList.toggle("is-error", !allConfirmed);
    setFieldError(form, "confirms", allConfirmed ? "" : "两项确认均须勾选");
    if (!allConfirmed) {
      valid = false;
      firstInvalid = firstInvalid || confirmGroup;
    }

    const upload = form.querySelector("[data-mvsp-upload]");
    const noUpload = upload && !upload.dataset.uploadedName;
    setFieldError(form, "taskPackage", noUpload ? "请上传 ZIP 任务包" : "");
    if (noUpload) {
      valid = false;
      firstInvalid = firstInvalid || upload;
    }

    if (!valid && firstInvalid) {
      firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return valid;
  }

  /* ---------- 收集与提交 ---------- */

  function collectPayload(form) {
    const val = (name) => form.querySelector(`[name="${name}"]`)?.value.trim() || "";
    const checkedList = (name) => Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map((item) => item.value);
    const radioVal = (name) => form.querySelector(`input[name="${name}"]:checked`)?.value || "";
    return {
      form: "mvsp-proposal",
      team: {
        name: val("name"),
        email: val("email"),
        phone: val("phone"),
        organization: val("organization"),
        researchArea: val("researchArea"),
        cooperationContext: checkedList("cooperationContext"),
        cooperationContextOther: val("cooperationContextOther"),
        relatedProject: val("relatedProject"),
        experience: val("experience")
      },
      problem: {
        taskTitle: val("taskTitle"),
        domain: val("domain"),
        taskLevel: radioVal("taskLevel"),
        question: val("question"),
        significance: val("significance"),
        evidenceGap: val("evidenceGap"),
        baseline: val("baseline")
      },
      design: {
        agentInputs: val("agentInputs"),
        expectedOutputs: val("expectedOutputs"),
        envDeps: val("envDeps"),
        toolDeps: val("toolDeps"),
        harness: radioVal("harness"),
        constraints: val("constraints"),
        resources: val("resources"),
        successCriteria: val("successCriteria"),
        expValidation: val("expValidation")
      },
      package: {
        fileName: form.querySelector("[data-mvsp-upload]")?.dataset.uploadedName || "",
        readiness: radioVal("packageReadiness"),
        gapNote: val("packageGap"),
        references: val("references"),
        usageRestrictions: val("usageRestrictions")
      },
      consent: {
        rights: Boolean(form.querySelector('input[name="confirmRights"]')?.checked),
        usage: Boolean(form.querySelector('input[name="confirmUsage"]')?.checked),
        training: radioVal("trainingConsent"),
        publish: radioVal("publishConsent")
      }
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

  async function postProposal(payload) {
    const url = String(window.SiteLinkConfig?.cooperationSubmitUrl || "").trim();
    if (!url) {
      console.info("[discovery-home] cooperationSubmitUrl 未配置，MVSP 表单数据如下（未上报）：", payload);
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

  /* ---------- 锚点条：点击定位 + 滚动联动 ---------- */

  function bindAnchors(form) {
    const body = form.querySelector(".tm-body");
    const bar = form.querySelector(".mvsp-anchor-bar");
    if (!body || !bar) return;
    const anchors = Array.from(bar.querySelectorAll("[data-mvsp-anchor]"));
    const sections = anchors.map((anchor) => form.querySelector(`[data-mvsp-section="${anchor.dataset.mvspAnchor}"]`));

    anchors.forEach((anchor, index) => {
      anchor.addEventListener("click", () => {
        const target = sections[index];
        if (!target) return;
        const top = target.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - bar.offsetHeight - 8;
        body.scrollTo({ top, behavior: "smooth" });
      });
    });

    function syncActive() {
      const bodyRect = body.getBoundingClientRect();
      if (!bodyRect.height) return; // 弹窗未打开时不联动，保持默认选中 01
      const probe = bodyRect.top + bar.offsetHeight + 8;
      let current = 0;
      sections.forEach((section, index) => {
        if (section && section.getBoundingClientRect().top <= probe) current = index;
      });
      anchors.forEach((anchor, index) => {
        if (index === current) anchor.setAttribute("aria-current", "true");
        else anchor.removeAttribute("aria-current");
      });
    }
    body.addEventListener("scroll", () => window.requestAnimationFrame(syncActive), { passive: true });

    /* 弹窗每次打开时重算一次（隐藏状态下布局为 0，跳过）。 */
    const anchorHost = form.closest("dialog") || form.closest(".tm-overlay");
    if (anchorHost) {
      const isOpen = () => (anchorHost.matches("dialog") ? anchorHost.open : anchorHost.getAttribute("aria-hidden") !== "true");
      new MutationObserver(() => {
        if (isOpen()) window.requestAnimationFrame(syncActive);
      }).observe(anchorHost, { attributes: true, attributeFilter: anchorHost.matches("dialog") ? ["open"] : ["aria-hidden"] });
    }
    syncActive();

    /* 选项内信息图标：点击/按键只展示提示，不触发选项选择。 */
    form.querySelectorAll(".tm-radio .mvsp-info").forEach((info) => {
      info.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      info.addEventListener("keydown", (event) => {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
        }
      });
    });
  }

  function bindForm(form) {
    if (!form || form.dataset.businessSubmitBound === "1") return;
    form.dataset.businessSubmitBound = "1";

    bindUpload(form);
    bindAnchors(form);
    restoreDraft(form);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!validateForm(form)) return;

      const payload = collectPayload(form);
      const submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      Promise.resolve(postProposal(payload))
        .then((result) => {
          if (result.status === "unconfigured") {
            showToast("提交通道未配置", "warning");
            return;
          }
          try {
            window.sessionStorage.removeItem(DRAFT_KEY);
          } catch (error) {
            /* ignore */
          }
          closeFormUi(form);
          showToast("提交成功", "success");
        })
        .catch((error) => {
          console.error("[discovery-home] MVSP 提交失败：", error, payload);
          showToast("提交失败，请稍后重试", "error");
        })
        .finally(() => {
          if (submitBtn) submitBtn.disabled = false;
        });
    }, true);

    form.addEventListener("input", (event) => {
      const field = event.target;
      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
        field.classList.remove("is-error");
        field.removeAttribute("aria-invalid");
        if (field.name) setFieldError(form, field.name, "");
        writeDraft(form);
      }
    });

    form.addEventListener("change", (event) => {
      const field = event.target;
      if (!(field instanceof HTMLInputElement)) return;
      const group = field.closest("[data-mvsp-group]");
      if (group) {
        group.classList.remove("is-error");
        setFieldError(form, group.dataset.mvspGroup, "");
      }
      syncConditionalFields(form);
      writeDraft(form);
    });
  }

  function init() {
    bindForm(document.querySelector("[data-cooperation-form]"));
    bindForm(document.querySelector("[data-local-cooperation-form]"));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
