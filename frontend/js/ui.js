/**
 * ui.js — small DOM helper utilities and shared component renderers,
 * plus the modal and the shared command-execution pipeline used by every
 * hardware command in the app.
 */
(function () {
  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }

  function badge(status, text) {
    const cls = { online: "succ", connected: "succ", ready: "succ", success: "succ", standby: "info", patrol: "accent", moving: "accent", offline: "err", failed: "err", inactive: "info" }[status] || "info";
    const dotCls = { online: "dot-online", connected: "dot-online", ready: "dot-online", success: "dot-online", attack: "dot-danger", patrol: "dot-info", moving: "dot-info", standby: "dot-info", offline: "dot-danger", failed: "dot-danger", inactive: "dot-info" }[status] || "dot-info";
    return '<span class="badge ' + cls + '"><span class="dot ' + dotCls + '"></span>' + (text || status) + "</span>";
  }

  // Value formatter for telemetry with empty state.
  function teleValue(v, suffix) {
    if (v == null) return '<span class="t-value empty">--' + (suffix || "") + "</span>";
    return '<span class="t-value">' + v + (suffix || "") + "</span>";
  }

  // Open modal with arbitrary body HTML + optional close button.
  function openModal(html, onClose) {
    const backdrop = document.getElementById("modalBackdrop");
    const box = document.getElementById("modalBox");
    box.innerHTML = html;
    backdrop.classList.remove("hidden");
    box.querySelectorAll("[data-close]").forEach((btn) => btn.addEventListener("click", () => closeModal()));
    function closeExtra() { if (onClose) onClose(); }
    box.querySelectorAll("[data-action-close]").forEach((btn) => btn.addEventListener("click", () => { closeModal(); closeExtra(); }));
    window.__currentModalClose = onClose;
  }

  function closeModal() {
    document.getElementById("modalBackdrop").classList.add("hidden");
    if (window.__currentModalClose) { const f = window.__currentModalClose; window.__currentModalClose = null; f(); }
  }
  document.getElementById("modalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "modalBackdrop") closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  // ------------------------------------------------------------------
  // Command execution pipeline. Every hardware command from the UI goes
  // through this. It:
  //   1. disables the triggering button + shows a spinner
  //   2. calls api.sendCommand({ source: "dashboard", command })
  //   3. renders the command-result modal
  //   4. records activity, updates top bar, shows toast
  // ------------------------------------------------------------------
  function runCommand(command, opts) {
    opts = opts || {};
    const button = opts.button;
    const previous = button ? button.innerHTML : "";
    if (button) {
      button.disabled = true;
      button.innerHTML = '<span class="spinner"></span> Sending…';
    }

    return api
      .sendCommand({ source: "dashboard", command })
      .then((res) => {
        handleCommandResult(res);
        EventBus.emit("command:executed", { command, result: res });
        return res;
      })
      .catch((err) => {
        toast.error("Command failed — " + (err.message || "network error"));
        return { success: false, command, reason: err.message };
      })
      .finally(() => {
        if (button) {
          button.disabled = false;
          button.innerHTML = previous;
        }
      });
  }

  function handleCommandResult(res) {
    if (!res) return;
    const mode = res.mode || "UNKNOWN";
    const status = res.success ? "succ" : "err";
    const statusText = res.success ? "✓ SUCCESS" : "✕ FAILED";
    openModal(
      '<div class="modal-head"><h2>Command Result</h2><button class="modal-close" data-close>✕</button></div>' +
        '<div class="cmd-result ' + status + '">' +
        '<div class="cr-command">' + (res.command || "--") + "</div>" +
        '<div class="kv"><span>Route</span><b>' + mode + "</b></div>" +
        '<div class="kv"><span>Status</span><b class="cr-status" style="color:' + (res.success ? "var(--ok)" : "var(--danger)") + '">' + statusText + "</b></div>" +
        (res.reason ? '<div class="kv"><span>Reason</span><b>' + safe(res.reason) + "</b></div>" : "") +
        (res.message && res.success ? '<div class="kv"><span>Message</span><b>' + safe(res.message) + "</b></div>" : "") +
        '<div class="modal-foot"><button class="btn primary" data-action-close>OK</button></div>' +
        "</div>"
    );

    // Record activity locally (works even in demo mode).
    if (res.activity) {
      window.AppState.activity.unshift(res.activity);
      if (window.AppState.activity.length > 100) window.AppState.activity.length = 100;
      EventBus.emit("activity:update", res.activity);
    }

    if (res.success) {
      if (res.message) toast.success(res.message ? res.message : "Command sent");
      else toast.success("Command sent");
    } else {
      toast.error("Command failed — " + (res.reason || "unknown reason"));
    }
  }

  function safe(v) {
    if (v == null) return "";
    return String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  window.UI = { el, badge, teleValue, openModal, closeModal, runCommand, handleCommandResult, safe };
})();
