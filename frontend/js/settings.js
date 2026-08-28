/**
 * settings.js — Configuration UI: backend URL, ESP32, Ollama, dashboard.
 * Supports multiple light and dark themes.
 */
(function () {
  const host = () => document.getElementById("page-settings");
  window.Settings = { render, onShow: render };

  const THEMES = [
    { id: "dark", name: "Dark (default)", group: "Dark" },
    { id: "graphite", name: "Graphite", group: "Dark" },
    { id: "dark-amber", name: "Dark · Amber accent", group: "Dark" },
    { id: "light", name: "Light", group: "Light" },
    { id: "slate", name: "Light · Slate", group: "Light" },
    { id: "light-green", name: "Light · Green accent", group: "Light" },
  ];

  function render() {
    const el = host();
    const s = window.AppState;
    const set = s.settings || {};

    el.innerHTML =
      '<div class="page-head"><div><h1>Settings</h1><div class="sub">Configuration & preferences</div></div>' +
      '<div class="spacer"><button class="btn primary sm" id="saveSettings">Save Settings</button></div></div>' +

      '<div class="grid grid-2">' +

      '<div class="panel"><div class="panel-head"><span class="panel-title">Appearance</span></div>' +
      '<div class="field"><label for="themeSelect">Theme</label>' +
      '<select id="themeSelect">' +
      THEMES.map((t) => '<option value="' + t.id + '"' + (document.body.dataset.theme === t.id ? " selected" : "") + ">" + t.group + " — " + t.name + "</option>").join("") +
      "</select><div class='hint'>Multiple dark and light themes are supported.</div></div>" +
      '<div class="field"><label for="refreshInterval">Refresh interval (seconds)</label>' +
      '<input type="number" id="refreshInterval" min="2" max="300" value="' + (set.refreshInterval || 5) + '" /></div>' +
      '<div class="field" style="display:flex;align-items:center;gap:10px">' +
      '<label class="switch"><input type="checkbox" id="cfgNotifications" ' + (set.notifications !== false ? "checked" : "") + " /><span class='slider'></span></label>" +
      "<label for='cfgNotifications' style='margin:0'>Notifications</label></div>" +
      "</div>" +

      '<div class="panel"><div class="panel-head"><span class="panel-title">Backend</span></div>' +
      '<div class="field"><label for="backendUrl">Backend URL</label>' +
      '<input type="text" id="backendUrl" placeholder="http://localhost:3000" value="' + UI.safe(set.backendUrl || "") + '" />' +
      "<div class='hint'>Leave blank to use DEMO mode without a backend.</div></div>" +
      "</div>" +

      '<div class="panel"><div class="panel-head"><span class="panel-title">ESP32</span></div>' +
      '<div class="field"><label for="esp32Host">ESP32 IP / Host</label>' +
      '<input type="text" id="esp32Host" value="' + UI.safe(set.esp32Host || "192.168.1.100") + '" /></div>' +
      '<div class="field"><label for="esp32Port">Port</label>' +
      '<input type="number" id="esp32Port" value="' + (set.esp32Port || 80) + '" /></div>' +
      "</div>" +

      '<div class="panel"><div class="panel-head"><span class="panel-title">Ollama</span></div>' +
      '<div class="field"><label for="ollamaEndpoint">Endpoint</label>' +
      '<input type="text" id="ollamaEndpoint" value="' + UI.safe(set.ollamaEndpoint || "http://127.0.0.1:11434") + '" /></div>' +
      '<div class="field"><label for="ollamaModel">Model</label>' +
      '<input type="text" id="ollamaModel" value="' + UI.safe(set.ollamaModel || "llama3") + '" /></div>' +
      '<div class="hint" style="color:var(--warn)">Secrets should be configured server-side via environment variables, not stored in this browser profile.</div>' +
      "</div>" +

      "</div>";

    document.getElementById("saveSettings").addEventListener("click", save);
    document.getElementById("themeSelect").addEventListener("change", (e) => applyTheme(e.target.value));
  }

  function applyTheme(id) {
    document.body.dataset.theme = id;
    window.AppState.settings = window.AppState.settings || {};
    const set = window.AppState.settings;
    if (set.theme !== id) { set.theme = id; }
    window.persistSettings();
    toast.success("Theme applied");
  }

  function save() {
    const set = window.AppState.settings || {};
    set.backendUrl = document.getElementById("backendUrl").value.trim();
    set.esp32Host = document.getElementById("esp32Host").value.trim();
    set.esp32Port = parseInt(document.getElementById("esp32Port").value, 10) || 80;
    set.ollamaEndpoint = document.getElementById("ollamaEndpoint").value.trim();
    set.ollamaModel = document.getElementById("ollamaModel").value.trim();
    set.refreshInterval = parseInt(document.getElementById("refreshInterval").value, 10) || 5;
    set.notifications = document.getElementById("cfgNotifications").checked;
    window.AppState.settings = set;
    persistSettings();
    // Re-bootstrap connection with new backend URL.
    window.__reconnect();
    toast.success("Settings saved");
  }

  EventBus.on("nav:page", (page) => {
    if (page === "settings") {
      const el = host();
      if (!el.querySelector("#saveSettings")) render();
    }
  });

  render();
})();
