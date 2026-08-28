/**
 * devices.js — Device inventory page.
 */
(function () {
  const host = () => document.getElementById("page-devices");
  window.Devices = { render, onShow: render };

  function render() {
    const el = host();
    el.innerHTML =
      '<div class="page-head"><div><h1>Devices</h1><div class="sub">Device inventory & connection status</div></div>' +
      '<div class="spacer"><span id="devSummary" class="badge info"></span></div></div>';

    const s = window.AppState;
    const online = s.devices.filter((d) => d.online).length;
    const summary = el.querySelector("#devSummary");
    if (summary) summary.textContent = online + " online · " + s.devices.length + " total";

    if (!s.devices.length) {
      el.insertAdjacentHTML("beforeend", '<div class="empty"><div class="e-icon">▤</div>No devices registered</div>');
      return;
    }

    const rows = s.devices
      .map((d) => {
        const lastSeen = d.online ? "Now" : "Never";
        return (
          '<div class="panel" style="margin-top:12px">' +
          '<div class="status-row"><span class="lbl">Name</span><span class="val" style="font-weight:700">' + UI.safe(d.name) + "</span></div>" +
          '<div class="status-row"><span class="lbl">Type</span><span class="val">' + UI.safe(d.type) + "</span></div>" +
          '<div class="status-row"><span class="lbl">Status</span><span class="val">' + UI.badge(d.online ? "online" : "offline", d.online ? "Online" : "Offline") + "</span></div>" +
          (d.pin != null ? '<div class="status-row"><span class="lbl">GPIO</span><span class="val mono">' + d.pin + "</span></div>" : "") +
          '<div class="status-row"><span class="lbl">Last Seen</span><span class="val">' + lastSeen + "</span></div>" +
          "</div>"
        );
      })
      .join("");
    el.insertAdjacentHTML("beforeend", rows);
  }

  EventBus.on("nav:page", (page) => {
    if (page === "devices") {
      const el = host();
      if (!el.querySelector(".panel")) render();
      else render(); // keep fresh — cheap
    }
  });

  render();
})();
