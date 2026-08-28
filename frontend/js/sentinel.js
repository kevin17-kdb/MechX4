/**
 * sentinel.js — Sentinel Rover page: status, camera, telemetry, movement
 * controls, patrol controls, emergency stop.
 */
(function () {
  const host = () => document.getElementById("page-sentinel");
  window.Sentinel = { render, onShow: refresh };

  function render() {
    const el = host();
    const page = isActive();
    el.innerHTML =
      '<div class="page-head"><div><h1>Sentinel Rover</h1><div class="sub">ESP32 rover control & telemetry</div></div>' +
      '<div class="spacer"><span id="roverStatusBadge"></span></div></div>' +

      '<div class="grid" style="grid-template-columns: 1.4fr 1fr">' +
      // Left column: camera + movement + patrol
      '<div>' +
      cameraPanel() +
      '<div class="panel"><div class="panel-head"><span class="panel-title">Rover Control</span></div>' +
      '<div class="mpad">' +
      '<span></span><button class="m-btn" data-command="FORWARD">▲ FORWARD</button><span></span>' +
      '<button class="m-btn" data-command="LEFT">◀ LEFT</button>' +
      '<button class="m-btn m-stop" data-command="STOP" aria-label="Stop">■ STOP</button>' +
      '<button class="m-btn" data-command="RIGHT">RIGHT ▶</button>' +
      '<span></span><button class="m-btn" data-command="REVERSE">▼ REVERSE</button><span></span>' +
      "</div>" +
      '<div class="grid grid-3" style="margin-top:14px">' +
      '<button class="btn ghost sm" data-command="MODE_MANUAL">Manual</button>' +
      '<button class="btn ghost sm" data-command="MODE_AUTO">Autonomous</button>' +
      '<button class="btn ghost sm" data-command="LIGHTS_ON">Lights</button>' +
      "</div>" +
      "</div>" +

      patrolPanel() +
      "</div>" +

      // Right column: telemetry
      '<div>' +
      '<div class="panel"><div class="panel-head"><span class="panel-title">Telemetry</span></div>' +
      '<div class="grid grid-2 telemetry-grid">' +
      telemetryCard("Battery", "rover-battery", "%") +
      telemetryCard("Wi-Fi Signal", "rover-signal", " dBm") +
      telemetryCard("Speed", "rover-speed", " cm/s") +
      telemetryCard("Distance", "rover-distance", " cm") +
      telemetryCard("Temperature", "rover-temp", " °C") +
      telemetryCard("Latency", "rover-latency", " ms") +
      "</div>" +
      '<div class="status-row"><span class="lbl">Mode</span><span class="val" id="roverModeVal">--</span></div>' +
      '<div class="status-row"><span class="lbl">Connection</span><span class="val" id="roverConnVal">--</span></div>' +
      "</div>" +
      "</div>" +
      "</div>";
  }

  function cameraPanel() {
    const set = (window.AppState && window.AppState.settings) || {};
    const host = set.esp32Host || "";
    const port = set.esp32Port || 81;
    return (
      '<div class="panel"><div class="panel-head"><span class="panel-title">Camera</span>' +
      '<div class="cam-actions">' +
      '<button class="btn sm" data-cam="fullscreen">⛶ Fullscreen</button>' +
      '<button class="btn sm" data-cam="snapshot">◉ Snapshot</button>' +
      "</div></div>" +
      '<div class="cam-config">' +
      '<input id="camHost" class="cam-host" type="text" placeholder="ESP32-CAM IP (e.g. 192.168.1.101)" value="' + UI.safe(host) + '" spellcheck="false" />' +
      '<input id="camPort" class="cam-port" type="number" min="1" max="65535" placeholder="81" value="' + (port || "") + '" />' +
      '<button class="btn primary sm" id="camConnect" data-cam="connect">▶ Connect</button>' +
      "</div>" +
      '<div class="camera-panel" id="cameraArea">' +
      '<div class="placeholder cam-placeholder" id="camPlaceholder">' +
      '<div class="cam-icon">📷</div><div><b>NO LIVE STREAM</b></div>' +
      '<div>Enter the ESP32-CAM IP above and press Connect</div>' +
      '<div style="margin-top:8px"><span class="badge err">Camera not connected</span></div>' +
      "</div>" +
      '<img class="camera-feed hidden" id="cameraFeed" alt="ESP32-CAM live stream" />' +
      "</div></div>"
    );
  }

  // Resolve the current camera address from the editable fields / settings.
  function camAddress() {
    const set = (window.AppState && window.AppState.settings) || {};
    let host = (document.getElementById("camHost") && document.getElementById("camHost").value.trim()) || set.esp32Host || "";
    const portEl = document.getElementById("camPort");
    const port = parseInt(portEl && portEl.value, 10) || set.esp32Port || 81;
    if (!host) return null;
    return { host: host.replace(/^https?:\/\//i, "").split("/")[0], port: port, query: encodeURIComponent(host) + "&port=" + port };
  }

  // Persist the edited CAM address into the shared settings (same source as Settings page).
  function saveCamAddress() {
    const set = window.AppState.settings || (window.AppState.settings = {});
    const hostEl = document.getElementById("camHost");
    const portEl = document.getElementById("camPort");
    if (hostEl) set.esp32Host = hostEl.value.trim();
    if (portEl) set.esp32Port = parseInt(portEl.value, 10) || 81;
    window.persistSettings();
  }

  // Toggle the live feed / placeholder based on camera state.
  function setCamStatus(connected) {
    const feed = document.getElementById("cameraFeed");
    const ph = document.getElementById("camPlaceholder");
    if (!feed || !ph) return;
    feed.classList.toggle("hidden", !connected);
    ph.classList.toggle("hidden", connected);
    const b = ph && ph.querySelector(".badge");
    if (connected) {
      const addr = camAddress();
      feed.src = "/api/camera/stream?host=" + addr.query;
      if (b) { b.className = "badge succ"; b.innerHTML = '<span class="dot dot-online"></span>Live · ' + addr.host; }
      if (ph) ph.querySelector("b").textContent = "LIVE STREAM";
    } else {
      feed.removeAttribute("src");
      if (b) { b.className = "badge err"; b.textContent = "Camera not connected"; }
      if (ph) ph.querySelector("b").textContent = "NO LIVE STREAM";
    }
  }

  function connectCamera() {
    const addr = camAddress();
    if (!addr) { toast.error("Enter an ESP32-CAM IP address first"); return; }
    saveCamAddress();
    setCamStatus(true);
    toast.info("Connecting to camera at " + addr.host + ":" + addr.port + "…");
    document.getElementById("cameraFeed").addEventListener(
      "error",
      function onErr() {
        this.removeEventListener("error", onErr);
        setCamStatus(false);
        toast.error("Cannot reach camera at " + addr.host + ":" + addr.port);
      },
      { once: true }
    );
  }

  function snapshotCamera() {
    const addr = camAddress();
    if (!addr) { toast.error("Enter an ESP32-CAM IP address first"); return; }
    saveCamAddress();
    window.open("/api/camera/snapshot?host=" + addr.query, "_blank");
  }

  function fullscreenCamera() {
    const feed = document.getElementById("cameraFeed");
    if (!feed || feed.classList.contains("hidden")) { toast.info("Connect the camera first"); return; }
    if (feed.requestFullscreen) feed.requestFullscreen();
    else toast.info("Fullscreen not supported");
  }

  function telemetryCard(label, id, suffix) {
    return (
      '<div class="telemetry">' +
      '<div class="t-label">' + label + "</div>" +
      '<div class="t-body" id="' + id + '">' + UI.teleValue(null, suffix) + "</div>" +
      "</div>"
    );
  }

  function patrolPanel() {
    return (
      '<div class="panel"><div class="panel-head"><span class="panel-title">Patrol Mode</span></div>' +
      '<div id="patrolBody">' +
      '<div class="status-row"><span class="lbl">Status</span><span class="val" id="patrolStatus">○ Inactive</span></div>' +
      '<div class="status-row"><span class="lbl">Started</span><span class="val" id="patrolStarted">--</span></div>' +
      '<div class="status-row"><span class="lbl">State</span><span class="val" id="patrolState">--</span></div>' +
      '<div class="status-row"><span class="lbl">Sensors</span><span class="val" style="color:var(--text-3)">Awaiting sensor data</span></div>' +
      '<div style="display:flex;gap:10px;margin-top:12px">' +
      '<button class="btn primary wide" data-command="START_PATROL" id="startPatrol">Start Patrol</button>' +
      '<button class="btn wide" data-command="STOP_PATROL" id="stopPatrol">Stop Patrol</button>' +
      "</div>" +
      '<div style="margin-top:10px;font-size:11px;color:var(--text-3)">Future: route, waypoints, intrusion & object detection.</div>' +
      "</div>" +
      "</div>"
    );
  }

  // Wire handlers once (event delegation so re-render is safe).
  function wire(el) {
    el.addEventListener("click", (e) => {
      if (e.target.closest("[data-command]")) {
        const btn = e.target.closest("[data-command]");
        UI.runCommand(btn.dataset.command, { button: btn });
      }
      const cam = e.target.closest("[data-cam]");
      if (cam) {
        const kind = cam.dataset.cam;
        if (kind === "connect") connectCamera();
        else if (kind === "snapshot") snapshotCamera();
        else if (kind === "fullscreen") fullscreenCamera();
      }
    });
    // Support keyboard shortcut: space = stop (when not typing in an input)
    el.addEventListener("keydown", (e) => {
      return; // handled globally in app
    });
  }

  function refresh() {
    const el = host();
    if (!el.classList.contains("active")) render();
    // status badge
    const s = window.AppState;
    const badgeEl = document.getElementById("roverStatusBadge");
    if (badgeEl) {
      const st = s.rover.status;
      badgeEl.innerHTML = UI.badge(st, st.toUpperCase());
    }
    // telemetry
    setTele("rover-battery", s.rover.battery, "%");
    setTele("rover-signal", s.rover.signal, " dBm");
    setTele("rover-speed", s.rover.speed, " cm/s");
    setTele("rover-distance", s.rover.distance, " cm");
    setTele("rover-temp", s.rover.temperature, " °C");
    setTele("rover-latency", s.rover.latency, " ms");
    setText("roverModeVal", s.mode);
    setText("roverConnVal", s.connection.esp32 ? "● Connected" : "○ Offline");

    // patrol
    const p = s.rover.patrol;
    setText("patrolStatus", p.active ? "● PATROL ACTIVE" : "○ Inactive");
    setText("patrolStarted", p.started ? new Date(p.started).toLocaleTimeString() : "--");
    setText("patrolState", p.state || "--");
  }

  function setTele(id, v, suffix) {
    const node = document.getElementById(id);
    if (node) node.innerHTML = UI.teleValue(v, suffix);
  }
  function setText(id, v) {
    const node = document.getElementById(id);
    if (node) node.textContent = v == null ? "--" : v;
  }
  function isActive() {
    return document.getElementById("page-sentinel").classList.contains("active");
  }

  // Called on first activation
  EventBus.on("nav:page", (page) => {
    if (page === "sentinel") {
      const el = host();
      if (!el.hasChildNodes() || !el.querySelector(".mpad")) {
        render();
        wire(el);
      } else if (!el.classList.contains("active")) {
        // already rendered, ensure wired (idempotent by delegation)
        wire(el);
      }
      refresh();
    }
  });

  // Refresh telemetry when rover updates.
  EventBus.on("rover:update", () => {
    if (host().classList.contains("active")) refresh();
  });

  render();
  wire(host());
})();
