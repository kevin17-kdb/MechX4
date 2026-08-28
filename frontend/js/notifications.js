/**
 * notifications.js — lightweight toast system.
 * Show success / error / warning / info toasts.
 */
(function () {
  function show(type, message, opts) {
    opts = opts || {};
    const host = document.getElementById("toastHost");
    if (!host) return;
    const icons = { succ: "✓", err: "✕", warn: "⚠", info: "ℹ" };
    const el = document.createElement("div");
    el.className = "toast " + type;
    el.setAttribute("role", "status");
    el.innerHTML = '<span class="t-icon">' + (icons[type] || "") + "</span><span></span>";
    el.querySelector("span:last-child").textContent = message;
    host.appendChild(el);
    const ttl = opts.ttl == null ? 4000 : opts.ttl;
    setTimeout(() => {
      el.classList.add("dismiss");
      setTimeout(() => el.remove(), 260);
    }, ttl);
  }

  window.toast = {
    success: (m, o) => show("succ", m, o),
    error: (m, o) => show("err", m, o),
    warning: (m, o) => show("warn", m, o),
    info: (m, o) => show("info", m, o),
  };
})();
