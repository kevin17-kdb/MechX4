/**
 * state.js — centralized application state.
 *
 * Never manipulate DOM state here. The store is the single source of truth;
 * individual page modules subscribe via the event bus and re-render.
 */
(function () {
  const defaults = {
    system: { status: "OPERATIONAL" },
    rover: {
      status: "standby",
      battery: null,
      signal: null,
      speed: null,
      distance: null,
      temperature: null,
      latency: null,
      patrol: { active: false, started: null, state: "Scanning" },
    },
    devices: [],
    assistant: {
      messages: [
        {
          role: "ai",
          text: "Systems are operational. I can route commands to the rover, IoT devices, or answer questions. How can I help?",
        },
      ],
    },
    activity: [],
    connection: { backend: false, esp32: false, ollama: false },
    mode: "SENTINEL",
    demoMode: true,
    lastCommand: null,
    lastError: null,
  };

  const storageKey = "mechx4.state.v1";

  // Read a settings subset from localStorage (theme refresh, backend url, etc.)
  function loadSettings() {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  const state = Object.assign({}, defaults, loadSettings());
  state.assistant = Object.assign({ messages: defaults.assistant.messages.slice() }, state.assistant);

  window.AppState = state;
  window.persistSettings = function () {
    const toPersist = {
      settings: state.settings || {},
      theme: document.body.dataset.theme || "dark",
      assistant: { messages: state.assistant.messages },
    };
    try {
      localStorage.setItem(storageKey, JSON.stringify(toPersist));
    } catch (e) {
      /* storage unavailable — ignore */
    }
  };
})();
