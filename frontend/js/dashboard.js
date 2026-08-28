/**
 * dashboard.js — Overview page: system status hero, quick actions, recent activity.
 */
(function () {
  const host = () => document.getElementById("page-overview");
  window.Dashboard = { render };

  function render() {
    const el = host();
    const s = window.AppState;
    el.innerHTML =
      '<div class="page-head"><div><h1>Command Center</h1><div class="sub">AI Sentinel · MechX4 · Integrated Security & Automation</div></div>' +
      '<div class="spacer">' + UI.badge(s.demoMode ? "inactive" : "succ", s.demoMode ? "DEMO MODE" : "LIVE") + "</div></div>" +
      '<div class="grid grid-3">' +
      heroPanel() +
      quickActionsPanel() +
      recentActivityPanel(s) +
      "</div>";

    // Re-run initial data population
    populateHero();
  }

  function heroPanel() {
    const s = window.AppState;
    const systems = [
      { id: "hero-backend", label: "Backend", status: "offline", live: s.connection.backend },
      { id: "hero-esp32", label: "ESP32", status: "offline", live: s.connection.esp32 },
      { id: "hero-ollama", label: "Ollama", status: "offline", live: s.connection.ollama },
      { id: "hero-rover", label: "Rover", status: "offline", live: false },
      { id: "hero-iot", label: "IoT Network", status: "offline", live: false },
    ];
    return (
      '<div class="panel">' +
      '<div class="hero-title">AI SENTINEL</div>' +
      '<div class="hero-state ok-color" id="heroState">SYSTEM OPERATIONAL</div>' +
      '<div class="status-list" id="heroSystems">' +
      systems
        .map(
          (x) =>
            '<div class="status-row"><span class="lbl"><span class="dot dot-danger" id="' + x.id + '-dot"></span> ' + x.label + "</span><span class='val' id='" + x.id + "' style='color:var(--text-3)'>checking…</span></div>"
        )
        .join("") +
      "</div>" +
      "</div>"
    );
  }

  function quickActionsPanel() {
    const actions = [
      { c: "START_PATROL", icon: "▶", label: "Start Patrol" },
      { c: "STOP_PATROL", icon: "■", label: "Stop Patrol" },
      { c: "FORWARD", icon: "▲", label: "Rover Forward" },
      { c: "REVERSE", icon: "▼", label: "Rover Reverse" },
      { c: "LIGHTS_ON", icon: "☀", label: "Lights On" },
      { c: "LIGHTS_OFF", icon: "☾", label: "Lights Off" },
    ];
    return (
      '<div class="panel"><div class="panel-head"><span class="panel-title">Quick Actions</span></div>' +
      '<div class="quick-actions" id="quickActions">' +
      actions
        .map(
          (a) =>
            '<button class="qa-btn" data-command="' + a.c + '"><span class="qa-icon">' + a.icon + "</span><span class='qa-label'>" + a.label + "</span></button>"
        )
        .join("") +
      '<button class="qa-btn danger-qa" id="qaStopAll"><span class="qa-icon">⏹</span><span class="qa-label">STOP ALL</span></button>' +
      '<a class="qa-btn" href="#sentinel"><span class="qa-icon">⬢</span><span class="qa-label">Rover Control</span></a>' +
      '<a class="qa-btn" href="#iot"><span class="qa-icon">⌁</span><span class="qa-label">IoT Control</span></a>' +
      "</div></div>"
    );
  }

  function recentActivityPanel(s) {
    const rows = s.activity.slice(0, 8);
    const body = rows.length
      ? rows
          .map((a) => {
            const time = new Date(a.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            const ok = a.status === "success";
            return (
              '<div class="activity-item"><span class="a-time">' + time + "</span><span class='a-cmd'>" + a.command + "</span>" +
              '<span class="' + (ok ? "a-mode-chip succ" : "a-mode-chip err") + '">' + (ok ? "SUCCESS" : "FAILED") + "</span></div>"
            );
          })
          .join("")
      : '<div class="empty"><div class="e-icon">≣</div>No commands yet</div>';
    return (
      '<div class="panel"><div class="panel-head"><span class="panel-title">Recent Activity</span>' +
      '<a href="#activity" class="btn ghost sm">View all</a></div>' +
      '<div id="recentActivity">' + body + "</div></div>"
    );
  }

  // Populate hero status + wire quick action buttons.
  function populateHero() {
    // Quick actions
    const qa = document.getElementById("quickActions");
    if (qa) {
      qa.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-command]");
        if (btn) UI.runCommand(btn.dataset.command, { button: btn });
      });
    }
    const stopAll = document.getElementById("qaStopAll");
    if (stopAll) stopAll.addEventListener("click", () => window.App.doEmergencyStop(stopAll));

    // Wire to state updates
    refreshHero();
    EventBus.on("system:update", refreshHero);
  }

  function refreshHero() {
    const s = window.AppState;
    const stateEl = document.getElementById("heroState");
    const systems = [
      { id: "hero-backend", label: "Backend", status: s.connection.backend ? "online" : "offline", val: s.connection.backend ? "● Online" : "○ Offline" },
      { id: "hero-esp32", label: "ESP32", status: s.connection.esp32 ? "connected" : "offline", val: s.connection.esp32 ? "● Connected" : "○ Offline" },
      { id: "hero-ollama", label: "Ollama", status: s.connection.ollama ? "ready" : "offline", val: s.connection.ollama ? "● Ready" : "○ Not ready" },
      { id: "hero-rover", label: "Rover", status: s.rover.status, val: formatRoverStatus(s.rover.status) },
      { id: "hero-iot", label: "IoT Network", status: s.devices.some((d) => d.online) ? "online" : "offline", val: s.devices.filter((d) => d.online).length + " Devices Online" },
    ];

    if (stateEl) {
      const anyOffline = !s.connection.backend || !s.connection.esp32 || !s.connection.ollama;
      stateEl.className = "hero-state " + (anyOffline ? (s.demoMode ? "warn-color" : "danger-color") : "ok-color");
      stateEl.textContent = s.demoMode ? "DEMO MODE" : "SYSTEM OPERATIONAL";
    }

    systems.forEach((x) => {
      const valEl = document.getElementById(x.id);
      const dotEl = document.getElementById(x.id + "-dot");
      if (valEl) {
        valEl.textContent = x.val;
        const ok = x.status !== "offline" && !(x.id === "hero-rover" && x.status === "offline");
        valEl.style.color = x.status === "offline" ? "var(--text-3)" : "var(--text)";
      }
      if (dotEl) {
        dotEl.className =
          "dot " +
          (x.status === "offline" ? "dot-danger" : x.status === "online" || x.status === "connected" || x.status === "ready" ? "dot-online" : "dot-info");
      }
    });
  }

  function formatRoverStatus(st) {
    const map = { standby: "● Standby", patrol: "● Patrol", moving: "● Moving", offline: "○ Offline" };
    return map[st] || st;
  }

  // Refresh the recent-activity list when new activity arrives.
  EventBus.on("activity:update", () => {
    const recent = document.getElementById("recentActivity");
    if (recent && document.getElementById("page-overview").classList.contains("active")) {
      const s = window.AppState;
      const rows = s.activity.slice(0, 8);
      recent.innerHTML = rows.length
        ? rows
            .map((a) => {
              const time = new Date(a.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
              const ok = a.status === "success";
              return (
                '<div class="activity-item"><span class="a-time">' + time + "</span><span class='a-cmd'>" + a.command + "</span>" +
                '<span class="' + (ok ? "a-mode-chip succ" : "a-mode-chip err") + '">' + (ok ? "SUCCESS" : "FAILED") + "</span></div>"
              );
            })
            .join("")
        : '<div class="empty"><div class="e-icon">≣</div>No commands yet</div>';
    }
  });

  // Render on navigation back to overview (preserves state; cheap re-render).
  EventBus.on("nav:page", (page) => {
    if (page === "overview") {
      const el = host();
      if (!el.querySelector(".quick-actions")) render();
      else refreshHero();
    }
  });

  render();
})();
