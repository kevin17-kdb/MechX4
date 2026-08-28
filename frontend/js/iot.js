/**
 * iot.js — IoT Control page: modular device cards + GPIO pin monitoring.
 * Devices are rendered from data objects (window.AppState.devices) so new
 * devices can be added without rewriting the page.
 */
(function () {
  const host = () => document.getElementById("page-iot");
  window.IoT = { render, onShow: refresh };

  function render() {
    const el = host();
    el.innerHTML =
      '<div class="page-head"><div><h1>IoT Control</h1><div class="sub">ESP32-connected appliances & GPIO devices</div></div>' +
      '<div class="spacer"><span id="iotSummary" class="badge info"></span></div></div>' +

      '<div class="panel"><div class="panel-head"><span class="panel-title">Devices</span></div>' +
      '<div class="grid grid-auto" id="deviceGrid"><div class="loading-block"><span class="spinner"></span> Loading devices…</div></div>' +
      "</div>";

    // GPIO section
    el.insertAdjacentHTML(
      "beforeend",
      '<div class="panel" style="margin-top:16px"><div class="panel-head"><span class="panel-title">ESP32 GPIO</span>' +
        '<span class="badge warn">Config-driven · read-only</span></div>' +
        '<p style="margin-top:0;color:var(--text-3);font-size:12px">Pin states below are reported by the backend. The dashboard never controls GPIO directly — structured device commands are validated by the server.</p>' +
        '<div id="gpioTable" class="mono"><div class="empty">No pin data available</div></div>' +
        "</div>"
    );

    renderDevices();
    renderGpio();
  }

  function renderDevices() {
    const grid = document.getElementById("deviceGrid");
    if (!grid) return;
    const devices = window.AppState.devices;
    if (!devices || !devices.length) {
      grid.innerHTML = '<div class="empty"><div class="e-icon">⌁</div>No devices configured</div>';
      return;
    }
    grid.innerHTML = devices
      .map((d) => {
        const on = d.state;
        return (
          '<div class="device-card">' +
          '<div class="d-head"><div><div class="d-name">' + UI.safe(d.name) + '</div><div class="d-type">' + UI.safe(d.type) + (d.pin != null ? " · GPIO " + d.pin : "") + "</div></div>" +
          UI.badge(d.online ? "online" : "offline", d.online ? "Online" : "Offline") +
          "</div>" +
          '<div class="status-row"><span class="lbl">State</span><span class="val" id="devstate-' + d.id + '">' + (on ? "ON" : "OFF") + "</span></div>" +
          '<div class="d-controls">' +
          '<button class="btn sm primary" data-device="' + d.id + '" data-action="ON">ON</button>' +
          '<button class="btn sm" data-device="' + d.id + '" data-action="OFF">OFF</button>' +
          "</div>" +
          "</div>"
        );
      })
      .join("");
  }

  function renderGpio() {
    const tbl = document.getElementById("gpioTable");
    if (!tbl) return;
    const pins = window.AppState.devices.filter((d) => d.pin != null);
    if (!pins.length) {
      tbl.innerHTML = '<div class="empty">No configured GPIO pins</div>';
      return;
    }
    tbl.innerHTML =
      '<table style="width:100%;border-collapse:collapse;font-size:13px">' +
      "<tr style='color:var(--text-3);text-align:left'><th style='padding:6px'>GPIO</th><th>Direction</th><th>State</th></tr>" +
      pins
        .map(
          (d) =>
            "<tr><td style='padding:6px'>" + d.pin + "</td><td style='padding:6px'>" + d.type.toUpperCase() + '</td><td style="padding:6px" id="pinstate-' + d.id + '">' + (d.online ? (d.state ? "HIGH" : "LOW") : "OFFLINE") + "</td></tr>"
        )
        .join("") +
      "</table>";
  }

  function wire(el) {
    el.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-device]");
      if (!btn) return;
      const device = btn.dataset.device;
      const action = btn.dataset.action;
      runDeviceCommand(device, action, btn);
    });
  }

  function runDeviceCommand(device, action, btn) {
    // Structured device command — maps to canonical token on backend.
    const mapped = { ON: "_ON", OFF: "_OFF" };
    btn.disabled = true;
    const original = btn.textContent;
    btn.innerHTML = '<span class="spinner"></span>';

    api
      .sendCommand({ source: "dashboard", device, action })
      .then((res) => {
        UI.handleCommandResult(res);
        EventBus.emit("command:executed", { command: res.command, result: res });
        // Optimistic device state reflect from result
        if (res.success && res.command) {
          const cmd = res.command;
          const dv = window.AppState.devices.find((x) => x.id === device);
          if (dv) {
            dv.state = cmd.endsWith("_ON");
            refresh();
          }
        }
      })
      .finally(() => {
        btn.disabled = false;
        btn.textContent = original;
      });
  }

  function refresh() {
    const el = host();
    const summary = document.getElementById("iotSummary");
    const s = window.AppState;
    const online = s.devices.filter((d) => d.online).length;
    if (summary) summary.textContent = online + " / " + s.devices.length + " devices online";
    renderDevices();
    renderGpio();
  }

  EventBus.on("nav:page", (page) => {
    if (page === "iot") {
      const el = host();
      if (!el.querySelector(".device-card") && !el.querySelector(".loading-block")) {
        render();
        wire(el);
      } else if (!el.classList.contains("active")) {
        wire(el);
      }
      refresh();
    }
  });

  render();
  wire(host());
})();
