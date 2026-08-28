/**
 * assistant.js — AI Assistant interface.
 * Sends the raw user message to the backend via api.sendAssistantMessage().
 * The backend router classifies the route (SENTINEL / IOT / ASSISTANT) and
 * executes; the AI never directly controls hardware.
 */
(function () {
  const host = () => document.getElementById("page-assistant");
  window.Assistant = { render, onShow: refresh };

  const EXAMPLES = [
    "Start patrol",
    "Stop the rover",
    "Move forward",
    "Turn left",
    "Turn right",
    "Turn on the bed light",
    "Turn off the fan",
    "What is the rover status?",
    "What is the system status?",
  ];

  function render() {
    const el = host();
    el.innerHTML =
      '<div class="page-head"><div><h1>Sentinel AI</h1><div class="sub">Local Assistant · Ollama</div></div>' +
      '<div class="spacer"><span id="assistantRoute" class="route-chip">ROUTED AS —</span></div></div>' +

      '<div class="chat" id="chat">' +
      '<div class="chat-log" id="chatLog"></div>' +
      '<div class="chat-input">' +
      '<button class="mic-btn" id="micBtn" title="Voice input (coming soon)" aria-label="Record voice">🎙</button>' +
      '<input id="chatText" type="text" placeholder="Type a command or question…" autocomplete="off" />' +
      '<button class="btn primary" id="sendBtn">➤</button>' +
      "</div>" +
      "</div>" +

      '<div class="panel" style="margin-top:16px"><div class="panel-head"><span class="panel-title">Suggested Commands</span></div>' +
      '<div class="quick-actions" id="suggestions">' +
      EXAMPLES.map((s) => '<button class="qa-btn" data-suggest="' + UI.safe(s) + '"><span class="qa-icon">✉</span><span class="qa-label">' + UI.safe(s) + "</span></button>").join("") +
      "</div>" +
      '<div style="margin-top:12px;display:flex;gap:10px">' +
      '<button class="btn ghost sm" id="clearChat">Clear conversation</button>' +
      "</div></div>";

    renderMessages();
    wire();
  }

  function renderMessages() {
    const log = document.getElementById("chatLog");
    if (!log) return;
    log.innerHTML = "";
    window.AppState.assistant.messages.forEach((m) => {
      log.appendChild(buildMsgEl(m));
    });
    log.scrollTop = log.scrollHeight;
  }

  function buildMsgEl(m) {
    const div = document.createElement("div");
    div.className = "msg " + (m.role === "user" ? "user" : "ai");
    if (m.route && m.role === "ai") {
      const r = document.createElement("div");
      r.className = "msg-route";
      r.textContent = "ROUTED AS " + m.route;
      div.appendChild(r);
    }
    const p = document.createElement("div");
    p.textContent = m.text;
    div.appendChild(p);
    return div;
  }

  function wire() {
    const input = document.getElementById("chatText");
    const send = document.getElementById("sendBtn");
    const mic = document.getElementById("micBtn");
    const clear = document.getElementById("clearChat");

    function submit() {
      const text = input.value.trim();
      if (!text) return;
      sendMessage(text);
      input.value = "";
    }
    send.addEventListener("click", submit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });
    mic.addEventListener("click", () => {
      toast.info("Voice input coming soon");
    });
    clear.addEventListener("click", () => {
      window.AppState.assistant.messages = [];
      renderMessages();
      toast.info("Conversation cleared");
    });

    document.getElementById("suggestions").addEventListener("click", (e) => {
      const b = e.target.closest("[data-suggest]");
      if (b) sendMessage(b.dataset.suggest);
    });
  }

  function sendMessage(text) {
    const s = window.AppState;
    s.assistant.messages.push({ role: "user", text });
    renderMessages();
    // typing indicator
    const log = document.getElementById("chatLog");
    const typing = document.createElement("div");
    typing.className = "msg ai typing";
    typing.innerHTML = "<span></span><span></span><span></span>";
    log.appendChild(typing);
    log.scrollTop = log.scrollHeight;
    // disable route chip while waiting
    const chip = document.getElementById("assistantRoute");
    if (chip) chip.textContent = "ROUTING…";

    api
      .sendAssistantMessage(text)
      .then((res) => {
        typing.remove();
        const route = res.mode || "ASSISTANT";
        const reply = res.message || "No response.";
        s.assistant.messages.push({ role: "ai", text: reply, route });
        renderMessages();
        if (chip) chip.textContent = "ROUTED AS " + route;
        if (res.activity) {
          s.activity.unshift(res.activity);
          EventBus.emit("activity:update", res.activity);
        }
        if (res.success) {
          EventBus.emit("system:update", s);
        }
      })
      .catch((e) => {
        typing.remove();
        s.assistant.messages.push({ role: "ai", text: "Sorry, an error occurred: " + (e.message || "network problem") });
        renderMessages();
        if (chip) chip.textContent = "ROUTED AS —";
        toast.error("Assistant request failed");
      });
  }

  function refresh() {
    renderMessages();
  }

  EventBus.on("nav:page", (page) => {
    if (page === "assistant") {
      const el = host();
      if (!el.querySelector(".chat")) {
        render();
      } else {
        renderMessages();
      }
    }
  });

  render();
})();
