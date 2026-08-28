/**
 * app.js — application bootstrap and global orchestration.
 * Wires the top status bar, clock, theme initialization, connectivity
 * polling, global emergency stop and keyboard shortcuts.
 */
(function () {
  const state = window.AppState;

  // ------------------------------------------------------------------
  // Global emergency stop
  // ------------------------------------------------------------------
  async function doEmergencyStop(button) {
    const proceed = await new Promise((resolve) => {
      UI.openModal(
        '<div class="modal-head"><h2>⚠ Emergency Stop</h2><button class="modal-close" data-close>✕</button></div>' +
          '<p>Send STOP ALL to the rover and all IoT devices? This halts all active operations.</p>' +
          '<div class="modal-foot">' +
          '<button class="btn ghost" data-close>Cancel</button>' +
          '<button class="danger-btn" id="confirmStop">STOP ALL</button>' +
          "</div>"
      );
      document.getElementById("confirmStop").addEventListener("click", () => {
        UI.closeModal();
        resolve(true);
      });
      document.querySelector('#modalBackdrop [data-close]') && document.querySelector('#modalBox [data-close]').addEventListener("click", () => resolve(false));
      document.querySelector('#modalBox .btn.ghost') && document.querySelector('#modalBox .btn.ghost').addEventListener("click", () => resolve(false));
    });

    if (!proceed) return;
    if (button) {
      button.disabled = true;
      const orig = button.innerHTML;
      button.innerHTML = '<span class="spinner"></span> STOPPING…';
      button.style.background = "var(--danger)";
      try {
        await api.sendCommand({ source: "dashboard", command: "STOP_ALL" }).then((res) => {
          UI.handleCommandResult(res);
          EventBus.emit("system:update", state);
          state.mode = "SENTINEL";
          state.rover.status = "standby";
          updateTopBar();
        });
      } finally {
        button.disabled = false;
        button.innerHTML = orig;
      }
    }
  }
  window.App = { doEmergencyStop };

  // ------------------------------------------------------------------
  // Clock
  // ------------------------------------------------------------------
  function updateClock() {
    const now = new Date();
    const t = document.getElementById("clockTime");
    const d = document.getElementById("clockDate");
    if (t) t.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    if (d) d.textContent = now.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  // ------------------------------------------------------------------
  // Top status bar update
  // ------------------------------------------------------------------
  function updateTopBar() {
    const conn = state.connection;
    setChip("barEsp32", conn.esp32, conn.esp32 ? "Connected" : "Offline", ["dot-online", "dot-danger"]);
    setChip("barOllama", conn.ollama, conn.ollama ? "Ready" : "Not Ready", ["dot-online", "dot-danger"]);
    updateSystemChip();
    const modeLabel = document.getElementById("modeLabel");
    if (modeLabel) modeLabel.textContent = state.mode;
    const demo = document.getElementById("demoBadge");
    if (demo) demo.classList.toggle("hidden", !state.demoMode);
  }
  function setChip(id, online, text, dots) {
    const chip = document.getElementById(id);
    if (!chip) return;
    const dot = chip.querySelector(".dot");
    const b = chip.querySelector("b");
    if (dot) dot.className = "dot " + (online ? dots[0] : dots[1]);
    if (b) b.textContent = text;
  }
  function updateSystemChip() {
    const chip = document.getElementById("barSystem");
    if (!chip) return;
    const allOnline = state.connection.backend && state.connection.esp32 && state.connection.ollama;
    const dot = chip.querySelector(".dot");
    const b = chip.querySelector("b");
    let label = "ONLINE";
    if (state.demoMode) { label = "DEMO"; dot.className = "dot dot-warn"; }
    else if (allOnline) { label = "ONLINE"; dot.className = "dot dot-online"; }
    else if (state.connection.backend) { label = "DEGRADED"; dot.className = "dot dot-warn"; }
    else { label = "OFFLINE"; dot.className = "dot dot-danger"; }
    if (b) b.textContent = label;
    document.getElementById("systemStateText").textContent = label;
  }

  // ------------------------------------------------------------------
  // Connectivity polling
  // ------------------------------------------------------------------
  async function poll() {
    try {
      const health = await api.getHealth();
      const live = health.live;
      state.connection.backend = live && health.backend === "online";
      state.connection.esp32 = live ? health.esp32 === "connected" : false;
      state.connection.ollama = live ? health.ollama === "ready" : false;
      state.demoMode = !live;
      if (live) {
        const status = await api.getSystemStatus();
        if (status.success) {
          state.system.status = status.system;
          state.mode = status.mode;
        }
      }
    } catch (e) {
      state.connection.backend = false;
      state.connection.esp32 = false;
      state.connection.ollama = false;
      state.demoMode = true;
    }
    updateTopBar();
    EventBus.emit("system:update", state);
  }

  // ------------------------------------------------------------------
  // Load devices/activity (seeded even in demo)
  // ------------------------------------------------------------------
  function seedDevices() {
    state.devices = [
      { id: "bedlight", name: "Bed Light", type: "light", pin: 5, state: false, online: false },
      { id: "fan", name: "Room Fan", type: "fan", pin: 4, state: false, online: false },
      { id: "relay1", name: "Relay 1", type: "relay", pin: 15, state: false, online: false },
      { id: "camera", name: "Camera", type: "camera", state: false, online: false },
    ];
    if (!state.demoMode) {
      // When live, devices online flag comes from backend getDevices().
    }
  }

  async function loadDevices() {
    try {
      const res = await api.getDevices();
      if (res && res.devices) {
        state.devices = res.devices;
      } else if (state.devices.length === 0) {
        seedDevices();
      }
    } catch (e) {
      seedDevices();
    }
    EventBus.emit("devices:update", state.devices);
  }

  // ------------------------------------------------------------------
  // Keyboard shortcuts: Space triggers STOP when on rover page & not typing.
  // ------------------------------------------------------------------
  function initKeyboard() {
    document.addEventListener("keydown", (e) => {
      if (e.key === " " && !e.repeat) {
        const tag = (e.target.tagName || "").toLowerCase();
        const typing = tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable;
        if (!typing && document.getElementById("page-sentinel").classList.contains("active")) {
          e.preventDefault();
          UI.runCommand("STOP", { button: document.querySelector("#page-sentinel [data-command=STOP]") });
        }
      }
    });
  }

  // ------------------------------------------------------------------
  // Theme initialization + persistence
  // ------------------------------------------------------------------
  function initTheme() {
    const stored = state.settings && state.settings.theme;
    const theme = stored || "dark";
    document.body.dataset.theme = theme;
  }

  // ------------------------------------------------------------------
  // Init
  // ------------------------------------------------------------------
  function init() {
    document.body.dataset.theme = document.body.dataset.theme || "dark";
    initTheme();
    seedDevices();
    updateClock();
    setInterval(updateClock, 1000);

    // Global stop button in sidebar
    document.getElementById("globalStop").addEventListener("click", (e) => doEmergencyStop(e.currentTarget));

    window.__reconnect = function () {
      poll();
      loadDevices();
    };

    // First render
    Router.activate(Router.currentPage());

    // Initial connectivity + data
    poll();
    loadDevices();

    initKeyboard();

    // Refresh cadence for telemetry (kept modest)
    const refresh = () => {
      const int = (state.settings && state.settings.refreshInterval) || 5;
      clearInterval(window.__refreshInterval);
      window.__refreshInterval = setInterval(async () => {
        if (document.body.hidden) return;
        try {
          const rover = await api.getRoverStatus();
          if (rover.success) {
            if (rover.battery != null) state.rover.battery = rover.battery;
            if (rover.signal != null) state.rover.signal = rover.signal;
            if (rover.speed != null) state.rover.speed = rover.speed;
            if (rover.distance != null) state.rover.distance = rover.distance;
            if (rover.temperature != null) state.rover.temperature = rover.temperature;
            if (rover.latency != null) state.rover.latency = rover.latency;
            if (rover.patrol) {
              state.rover.patrol.active = rover.patrol.active;
              state.rover.patrol.state = rover.patrol.state;
              if (rover.patrol.started) state.rover.patrol.started = rover.patrol.started;
            }
            state.rover.status = rover.status;
            EventBus.emit("rover:update", state.rover);
            EventBus.emit("system:update", state);
          }
        } catch (e) {
          /* telemetry unavailable */
        }
      }, int * 1000);
    };
    refresh();

    // Re-apply refresh interval when settings change
    EventBus.on("settings:changed", refresh);
  }

  document.addEventListener("DOMContentLoaded", init);
  if (document.readyState !== "loading") setTimeout(init, 0);
})();
