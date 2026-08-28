/**
 * health.js — System Health / diagnostics page.
 */
(function () {
  const host = () => document.getElementById("page-health");
  window.Health = { render, onShow: refresh };

  function render() {
    const el = host();
    el.innerHTML =
      '<div class="page-head"><div><h1>System Health</h1><div class="sub">Technical diagnostics</div></div>' +
      '<div class="spacer"><button class="btn ghost sm" id="healthRefresh">↻ Refresh</button></div></div>' +
      '<div class="grid grid-3">' +
      diagCard("backend", "Node.js / Express", ["Latency"]) +
      diagCard("esp32", "ESP32 Controller", ["IP", "Signal"]) +
      diagCard("ollama", "Ollama", ["Model"]) +
      diagCard("rover", "Rover", ["Battery"]) +
      diagCard("iot", "IoT Network", ["Devices Online"]) +
      diagCard("api", "API / Realtime", ["WebSocket / SSE", "Last Command", "Last Error"]) +
      "</div>";

    document.getElementById("healthRefresh").addEventListener("click", refresh);
    refresh();
  }

  function diagCard(id, title, fields) {
    return (
      '<div class="panel"><div class="panel-head"><span class="panel-title">' + title + '</span><span id="' + id + '-badge"></span></div>' +
      '<div id="' + id + "-fields" + '">' +
      fields.map((f) => statusRow(f.replace(/ /g, "-").toLowerCase(), f)).join("") +
      "</div></div>"
    );
  }
  function statusRow(id, label) {
    return '<div class="status-row"><span class="lbl" style="width:120px">' + label + '</span><span class="val" id="' + id + '" style="color:var(--text-3)">--</span></div>';
  }

  function refresh() {
    const s = window.AppState;
    setBadge("backend", s.connection.backend ? "online" : "offline", s.connection.backend ? "Online" : "Offline");
    setBadge("esp32", s.connection.esp32 ? "connected" : "offline", s.connection.esp32 ? "Connected" : "Offline");
    setBadge("ollama", s.connection.ollama ? "ready" : "offline", s.connection.ollama ? "Ready" : "Not ready");
    setBadge("rover", s.rover.status, s.rover.status.toUpperCase());
    const online = s.devices.filter((d) => d.online).length;
    setBadge("iot", online > 0 ? "online" : "offline", online + "/" + s.devices.length);

    setVal("latency", s.rover.latency != null ? s.rover.latency + " ms" : "--");
    setVal("ip", "--");
    setVal("signal", s.rover.signal != null ? s.rover.signal + " dBm" : "--");
    setVal("model", s.connection.ollama ? (s.settings && s.settings.ollamaModel) || "llama3" : "--");
    setVal("battery", s.rover.battery != null ? s.rover.battery + " %" : "--");
    setVal("devices-online", online + " / " + s.devices.length);

    setVal("websocket-sse", "Not connected (REST)");
    setVal("last-command", s.lastCommand ? s.lastCommand : "None");
    setVal("last-error", s.lastError ? s.lastError : "None");
  }

  function setBadge(id, status, text) {
    const node = document.getElementById(id + "-badge");
    if (node) node.innerHTML = UI.badge(status, text);
  }
  function setVal(id, v) {
    const node = document.getElementById(id);
    if (node) node.textContent = v;
  }

  EventBus.on("nav:page", (page) => {
    if (page === "health") {
      const el = host();
      if (!el.querySelector(".panel")) render();
      else refresh();
    }
  });
  EventBus.on("system:update", () => {
    if (host().classList.contains("active")) refresh();
  });

  render();
})();
