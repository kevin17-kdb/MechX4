/**
 * router.js — hash-based navigation between the SPA pages.
 * Switching pages does not reload or reset application state.
 */
(function () {
  const routes = ["overview", "sentinel", "iot", "assistant", "activity", "devices", "health", "settings"];

  function currentPage() {
    const hash = (location.hash || "").replace("#", "");
    return routes.includes(hash) ? hash : "overview";
  }

  function navigate(page) {
    location.hash = page;
  }

  function activate(page) {
    // Toggle page sections
    document.querySelectorAll(".page").forEach((el) => {
      el.classList.toggle("active", el.dataset.page === page);
    });
    // Toggle sidebar active link
    document.querySelectorAll(".nav-link").forEach((a) => {
      a.classList.toggle("active", a.dataset.route === page);
    });
    // Close mobile drawer
    closeDrawer();
    window.scrollTo(0, 0);
    // Emit so page modules can lazily load/refresh
    EventBus.emit("nav:page", page);

    // Notify page modules
    if (page === "sentinel") window.Sentinel && Sentinel.onShow();
    if (page === "iot") window.IoT && IoT.onShow();
    if (page === "devices") window.Devices && Devices.onShow();
    if (page === "health") window.Health && Health.onShow();
    if (page === "activity") window.Activity && Activity.onShow();
  }

  function closeDrawer() {
    const sb = document.getElementById("sidebar");
    const ov = document.getElementById("navOverlay");
    if (sb) sb.classList.remove("open");
    if (ov) ov.classList.remove("show");
  }

  window.Router = { navigate, activate, currentPage };

  // Sidebar links
  document.querySelectorAll(".nav-link").forEach((a) => {
    a.addEventListener("click", (e) => {
      // hash change will trigger hashchange; nothing extra needed
    });
  });

  // Nav toggle (mobile)
  const toggle = document.getElementById("navToggle");
  const overlay = document.getElementById("navOverlay");
  if (toggle) {
    toggle.addEventListener("click", () => {
      const sb = document.getElementById("sidebar");
      sb.classList.toggle("open");
      overlay.classList.toggle("show");
    });
  }
  if (overlay) {
    overlay.addEventListener("click", closeDrawer);
  }
  window.__closeDrawer = closeDrawer;

  window.addEventListener("hashchange", () => activate(currentPage()));
})();
