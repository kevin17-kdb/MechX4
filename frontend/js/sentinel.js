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
      '<div class="grid grid-2">' +
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
    return (
      '<div class="panel"><div class="panel-head"><span class="panel-title">Camera</span>' +
      '<div class="camera-bar">' +
      '<button class="btn sm" data-cam="fullscreen">⛶ Fullscreen</button>' +
      '<button class="btn sm" data-cam="snapshot">◉ Snapshot</button>' +
      "</div></div>" +
      '<div class="camera-panel" id="cameraArea">' +
      '<div class="placeholder"><div class="cam-icon">📷</div><div><b>NO LIVE STREAM</b></div><div>Camera integration pending</div>' +
      '<div style="margin-top:8px"><span class="badge err">Not connected</span></div></div>' +
      "</div></div>"
    );
  }

  function telemetryCard(label, id, suffix) {
    return '<div class="telemetry"><div class="t-label">' + label + '</div><div id="' + id + '">' + UI.teleValue(null, suffix) + "</div></div>";
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
        if (cam.dataset.cam === "snapshot") toast.info("Snapshot unavailable — camera not connected");
        if (cam.dataset.cam === "fullscreen") toast.info("Camera stream unavailable");
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
