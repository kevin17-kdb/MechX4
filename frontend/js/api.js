/**
 * api.js — the single frontend API abstraction.
 *
 * ALL network requests go through this module so backend endpoint URLs
 * live in exactly one place. It supports live mode (real backend) and
 * DEMO mode (isolated mock adapter). Categories of mock data are clearly
 * separated from production code paths.
 *
 * Real endpoint contract (see README / server.js):
 *   GET  /api/health
 *   GET  /api/status
 *   GET  /api/rover
 *   GET  /api/devices
 *   GET  /api/activity
 *   POST /api/command
 *   POST /api/assistant
 *   POST /api/rover/command
 *   POST /api/iot/command
 */
(function () {
  const state = window.AppState;

  // ---------------------------------------------------------------------
  // Mock adapter — only used when we cannot reach the backend.
  // All mock values are implicitly "demo", never presented as live.
  // ---------------------------------------------------------------------
  const mock = (function () {
    function delay(ms) {
      return new Promise((r) => setTimeout(r, ms));
    }
    function activityFor(next) {
      return {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        timestamp: new Date().toISOString(),
        ...next,
      };
    }
    return {
      async getHealth() {
        await delay(150);
        return {
          backend: "online",
          esp32: "offline",
          ollama: "ready",
          demoMode: true,
          uptime: Math.round((Date.now() - window.__mockBoot) / 1000),
        };
      },
      async getStatus() {
        await delay(150);
        const devicesOnline = state.devices.filter((d) => d.online).length;
        return {
          system: "OPERATIONAL",
          mode: state.mode,
          backend: "online",
          esp32: "offline",
          ollama: "ready",
          rover: state.rover.status,
          iot: { devicesOnline, devicesTotal: state.devices.length },
          devicesOnline,
          devicesTotal: state.devices.length,
          demoMode: true,
        };
      },
      async getRover() {
        await delay(120);
        return {
          status: state.rover.status,
          battery: null,
          signal: null,
          speed: null,
          distance: null,
          temperature: null,
          latency: null,
          patrol: { active: state.rover.patrol.active, started: null, state: state.rover.patrol.state },
        };
      },
      async getDevices() {
        await delay(120);
        return { devices: state.devices };
      },
      async getActivity() {
        await delay(80);
        return { activity: state.activity };
      },
      async sendCommand(payload) {
        await delay(260);
        // Mirror backend: map structured {device, action} onto a canonical token,
        // so demo IoT commands log correctly (same vocabulary as the live router).
        let command = payload.command;
        const dev = payload.device;
        const act = payload.action;
        if (!command && dev && act) {
          const dv = state.devices.find((d) => d.id === dev);
          command = dv ? String(dev).toUpperCase() + "_" + act : undefined;
        }
        const spec = window.COMMANDS[command] || { mode: "ASSISTANT", label: command };
        // Reflect device state in demo mode (live backend does this on the server).
        let stateChanged = false;
        let offlineReason = null;
        if (dev && act) {
          const dv = state.devices.find((d) => d.id === dev);
          // Honesty: an offline device cannot accept commands in demo either.
          if (dv) {
            if (dv.online) { dv.state = act === "ON"; stateChanged = true; }
            else offlineReason = "Device offline";
          } else {
            offlineReason = "Unknown device";
          }
        }
        if (offlineReason) {
          const entry = activityFor({ source: payload.source || "dashboard", command, mode: spec.mode, status: "failed", reason: offlineReason });
          state.activity.unshift(entry);
          if (state.activity.length > 100) state.activity.length = 100;
          EventBus.emit("activity:update", entry);
          return { success: false, mode: spec.mode, command, reason: offlineReason, activity: entry };
        }
        // Simulate success for every known command.
        const entry = activityFor({
          source: payload.source || "dashboard",
          command,
          mode: spec.mode,
          status: "success",
        });
        state.activity.unshift(entry);
        if (state.activity.length > 100) state.activity.length = 100;
        EventBus.emit("activity:update", entry);
        return { success: true, mode: spec.mode, command, message: spec.label, activity: entry };
      },
      async sendAssistant(message) {
        await delay(700);
        const t = message.toLowerCase();
        let reply =
          "I received your request. (Demo mode) — connect Ollama / the live backend to get real, routed responses.";
        if (t.includes("status")) reply = "Backend online. ESP32 offline. Rover standby. IoT devices configured but offline. Running in demo mode.";
        else if (t.includes("rover")) reply = "Rover is in standby. No live telemetry is available until ESP32 is connected.";
        else if (t.includes("patrol")) reply = "Patrol command would be routed to the SENTINEL mode.";
        const entry = activityFor({ source: "dashboard", command: "ASSISTANT", mode: "ASSISTANT", status: "success" });
        state.activity.unshift(entry);
        return { success: true, mode: "ASSISTANT", command: "ASSISTANT", message: reply, activity: entry };
      },
    };
  })();

  // ---------------------------------------------------------------------
  // Request helper — live backend.
  // ---------------------------------------------------------------------
  async function request(path, options) {
    const base = getBaseUrl();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), (options && options.timeout) || 6000);
    try {
      const res = await fetch(base + path, Object.assign({ signal: controller.signal }, options));
      clearTimeout(timeout);
      if (!res.ok) {
        throw new Error("HTTP " + res.status);
      }
      return await res.json();
    } catch (e) {
      clearTimeout(timeout);
      throw e;
    }
  }

  // Backend URL from settings (overridable in Settings page). When the
  // dashboard is served over http(s) by the backend itself (same origin),
  // auto-discover that origin so it connects with zero configuration. An
  // explicit Backend URL in Settings always takes precedence.
  function getBaseUrl() {
    const s = state.settings && state.settings.backendUrl;
    if (s && s.trim()) return s.trim();
    const proto = window.location && window.location.protocol;
    const host = window.location && window.location.host;
    if ((proto === "http:" || proto === "https:") && host) return proto + "//" + host;
    return "";
  }

  function isConfigured() {
    const s = state.settings && state.settings.backendUrl;
    if (s && s.trim()) return true;
    const proto = window.location && window.location.protocol;
    const host = window.location && window.location.host;
    return (proto === "http:" || proto === "https:") && !!host;
  }

  let lastAttempt; // "live" or "demo"
  window.__mockBoot = Date.now();

  // Decide live vs demo for a given request.
  function usingLive() {
    // If the user hasn't configured a backend URL, always use demo.
    if (!isConfigured()) return false;
    // When configured, try live but fall back to demo on network error.
    return lastAttempt === "live";
  }

  // Public API. Each method returns a Promise resolving to a normalized
  // { success, ... } object, never throwing for expected failures.
  window.api = {
    async getHealth() {
      if (isConfigured()) {
        try {
          const data = await request("/api/health");
          lastAttempt = "live";
          return { success: true, live: true, ...data };
        } catch (e) {
          lastAttempt = "demo";
          return { success: true, live: false, ...(await mock.getHealth()) };
        }
      }
      return { success: true, live: false, ...(await mock.getHealth()) };
    },

    async getSystemStatus() {
      if (usingLive()) {
        try { const d = await request("/api/status"); return { success: true, live: true, ...d }; }
        catch (e) { lastAttempt = "demo"; }
      }
      return { success: true, live: false, ...(await mock.getStatus()) };
    },

    async getRoverStatus() {
      if (usingLive()) {
        try { const d = await request("/api/rover"); return { success: true, live: true, ...d }; }
        catch (e) { lastAttempt = "demo"; }
      }
      return { success: true, live: false, ...(await mock.getRover()) };
    },

    async getDevices() {
      if (usingLive()) {
        try { const d = await request("/api/devices"); return { success: true, live: true, ...d }; }
        catch (e) { lastAttempt = "demo"; }
      }
      return { success: true, live: false, ...(await mock.getDevices()) };
    },

    async getActivity() {
      if (usingLive()) {
        try { const d = await request("/api/activity"); return { success: true, live: true, ...d }; }
        catch (e) { lastAttempt = "demo"; }
      }
      return { success: true, live: false, ...(await mock.getActivity()) };
    },

    async sendCommand(payload) {
      // This is the canonical path for ALL dashboard hardware commands.
      const body = Object.assign({ source: "dashboard" }, payload);
      if (usingLive()) {
        try { const d = await request("/api/command", { timeout: 30000, method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); return { success: true, live: true, ...d }; }
        catch (e) { lastAttempt = "demo"; }
      }
      return { success: true, live: false, ...(await mock.sendCommand(body)) };
    },

    async sendAssistantMessage(message) {
      // Natural-language route — backend decides SENTINEL / IOT / ASSISTANT.
      if (usingLive()) {
        try {
          const d = await request("/api/assistant", { timeout: 90000, method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: "dashboard", text: message }) });
          return { success: true, live: true, ...d };
        } catch (e) { lastAttempt = "demo"; }
      }
      return { success: true, live: false, ...(await mock.sendAssistant(message)) };
    },

    isDemo() {
      return !usingLive();
    },
  };
})();
