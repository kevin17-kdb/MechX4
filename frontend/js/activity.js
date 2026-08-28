/**
 * activity.js — Command / activity log with filtering and clearing.
 */
(function () {
  const host = () => document.getElementById("page-activity");
  let filter = "all";
  window.Activity = { render, onShow: render };

  function render() {
    const el = host();
    el.innerHTML =
      '<div class="page-head"><div><h1>Activity</h1><div class="sub">Command & event log</div></div>' +
      '<div class="spacer">' +
      '<select id="actFilter" style="background:var(--bg-2);border:1px solid var(--border);color:var(--text);border-radius:5px;padding:7px 10px">' +
      '<option value="all">All</option>' +
      '<option value="dashboard">Dashboard</option>' +
      '<option value="voice">Voice</option>' +
      '<option value="telegram">Telegram</option>' +
      "</select>" +
      '<button class="btn ghost sm" id="clearLog">Clear log</button>' +
      "</div></div>" +

      '<div class="panel"><div class="panel-head"><span class="panel-title">Command Log</span></div>' +
      '<div id="actList"></div></div>';

    document.getElementById("actFilter").addEventListener("change", (e) => {
      filter = e.target.value;
      draw();
    });
    document.getElementById("clearLog").addEventListener("click", () => {
      window.AppState.activity = [];
      draw();
      toast.info("Log cleared");
    });

    draw();
  }

  function draw() {
    const list = document.getElementById("actList");
    if (!list) return;
    let rows = window.AppState.activity.slice();
    if (filter !== "all") rows = rows.filter((a) => a.source === filter);

    if (!rows.length) {
      list.innerHTML = '<div class="empty"><div class="e-icon">≣</div>' + (filter === "all" ? "No commands yet" : "No " + filter + " activity yet") + "</div>";
      return;
    }

    list.innerHTML = rows
      .map((a) => {
        const time = new Date(a.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        const source = (a.source || "system").toUpperCase();
        const ok = a.status === "success";
        const modeClass = { SENTINEL: "sent", IOT: "iot", ASSISTANT: "assist" }[a.mode] || "";
        return (
          '<div class="activity-item" data-id=' + a.id + ' style="cursor:pointer">' +
          '<span class="a-time">' + time + "</span>" +
          '<span class="a-source">' + UI.safe(source) + "</span>" +
          '<span class="a-cmd">' + UI.safe(a.command || "--") + "</span>" +
          (a.mode ? '<span class="a-mode-chip ' + modeClass + '">' + UI.safe(a.mode) + "</span>" : "") +
          '<span class="a-mode-chip ' + (ok ? "succ" : "err") + '">' + (ok ? "SUCCESS" : "FAILED") + "</span>" +
          "</div>"
        );
      })
      .join("");

    list.querySelectorAll(".activity-item").forEach((row) => {
      row.addEventListener("click", () => showDetail(row.dataset.id));
    });
  }

  function showDetail(id) {
    const a = window.AppState.activity.find((x) => x.id === id);
    if (!a) return;
    const time = new Date(a.timestamp).toLocaleString();
    UI.openModal(
      '<div class="modal-head"><h2>Event Detail</h2><button class="modal-close" data-close>✕</button></div>' +
        '<div class="log-detail">' +
        kv("Timestamp", time) +
        kv("Source", (a.source || "system").toUpperCase()) +
        kv("Command", a.command || "--") +
        kv("Route / Mode", a.mode || "--") +
        kv("Status", a.status === "success" ? "✓ SUCCESS" : "✕ FAILED") +
        (a.reason ? kv("Reason", a.reason) : "") +
        "</div>" +
        '<div class="modal-foot"><button class="btn primary" data-close>Close</button></div>'
    );
  }
  function kv(k, v) {
    return '<div class="kv"><span>' + UI.safe(k) + "</span><b>" + UI.safe(v) + "</b></div>";
  }

  EventBus.on("activity:update", () => {
    if (host().classList.contains("active")) draw();
  });

  EventBus.on("nav:page", (page) => {
    if (page === "activity" && !host().querySelector(".activity-item") && !host().querySelector(".empty")) {
      // first build
      render();
    } else if (page === "activity") {
      draw();
    }
  });

  render();
})();
