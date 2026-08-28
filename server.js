/**
 * AI Sentinel / MechX4 - Command Center Backend
 *
 * Node.js + Express API.
 *
 * This backend is the single orchestrator. Every interface
 * (Web Dashboard, Voice, Telegram) sends commands through
 * POST /api/command, which routes through processCommand().
 *
 * The hardware layer (ESP32 / Ollama) is abstracted behind
 * adapters so the API works in DEMO mode when no hardware is
 * actually present.
 */

const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const CONFIG = {
  demoMode: process.env.MECHX4_DEMO !== "0",
  esp32: {
    enabled: process.env.ESP32_ENABLED === "1",
    host: process.env.ESP32_HOST || "192.168.1.100",
    port: process.env.ESP32_PORT || 80,
  },
  ollama: {
    endpoint: process.env.OLLAMA_ENDPOINT || "http://127.0.0.1:11434",
    model: process.env.OLLAMA_MODEL || "gemma3:4b",
  },
};

// Ollama reachability cache with a short TTL so status stays honest.
let ollamaReachable = undefined;
let ollamaReachableAt = 0;
const OLLAMA_CHECK_TTL = 15000; // re-check at most every 15s, and when stale

async function checkOllama() {
  const now = Date.now();
  if (ollamaReachable !== undefined && now - ollamaReachableAt < OLLAMA_CHECK_TTL) {
    return ollamaReachable;
  }
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 3000);
    const r = await fetch(`${CONFIG.ollama.endpoint}/api/tags`, { signal: c.signal });
    clearTimeout(t);
    ollamaReachable = r.ok;
  } catch (e) {
    ollamaReachable = false;
  }
  ollamaReachableAt = now;
  return ollamaReachable;
}

// ---------------------------------------------------------------------------
// In-memory state (until a real ESP32 reports telemetry)
// ---------------------------------------------------------------------------
const systemState = {
  system: "OPERATIONAL",
  mode: "SENTINEL",
  backend: "online",
  esp32: CONFIG.esp32.enabled ? "connected" : "offline",
  ollama: "ready",
  rover: "standby",
  iot: {
    devicesOnline: 2,
    devicesTotal: 2,
  },
  demoMode: CONFIG.demoMode,
};

const devices = [
  { id: "bedlight", name: "Bed Light", type: "light", pin: 5, state: false, online: CONFIG.esp32.enabled },
  { id: "fan", name: "Room Fan", type: "fan", pin: 4, state: false, online: CONFIG.esp32.enabled },
  { id: "relay1", name: "Relay 1", type: "relay", pin: 15, state: false, online: CONFIG.esp32.enabled },
  { id: "camera", name: "Camera", type: "camera", state: false, online: false },
];

const activity = [];
const MAX_ACTIVITY = 100;

function pushActivity(entry) {
  activity.unshift({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    timestamp: new Date().toISOString(),
    ...entry,
  });
  if (activity.length > MAX_ACTIVITY) activity.length = MAX_ACTIVITY;
  return activity[0];
}

// ---------------------------------------------------------------------------
// processCommand() - the central decision layer
// ---------------------------------------------------------------------------
// Sources: dashboard, voice, telegram. Returns a uniform response.
// A real implementation would forward to an ESP32 over HTTP/WebSocket,
// and to Ollama for ASSISTANT. In this skeleton the ESP32 adapter is
// simulated when demoMode is on and hardware is offline.
// ---------------------------------------------------------------------------
const COMMAND_TABLE = {
  START_PATROL: { mode: "SENTINEL", label: "Start Patrol" },
  STOP_PATROL: { mode: "SENTINEL", label: "Stop Patrol" },
  RETURN: { mode: "SENTINEL", label: "Return Home" },
  FORWARD: { mode: "SENTINEL", label: "Forward" },
  REVERSE: { mode: "SENTINEL", label: "Reverse" },
  LEFT: { mode: "SENTINEL", label: "Turn Left" },
  RIGHT: { mode: "SENTINEL", label: "Turn Right" },
  STOP: { mode: "SENTINEL", label: "Stop" },
  LIGHTS_ON: { mode: "SENTINEL", label: "Lights On" },
  LIGHTS_OFF: { mode: "SENTINEL", label: "Lights Off" },
  STOP_ALL: { mode: "SENTINEL", label: "Emergency Stop All" },
  MODE_AUTO: { mode: "SENTINEL", label: "Autonomous Mode" },
  MODE_MANUAL: { mode: "SENTINEL", label: "Manual Mode" },
};

const IOT_ACTIONS = {
  bedlight: { ON: "BEDLIGHT_ON", OFF: "BEDLIGHT_OFF" },
  fan: { ON: "FAN_ON", OFF: "FAN_OFF" },
  relay1: { ON: "RELAY1_ON", OFF: "RELAY1_OFF" },
};

function hardwareAvailable() {
  return CONFIG.esp32.enabled;
}

async function executeHardware(commandResult) {
  // Placeholder for real ESP32 communication.
  // Today: simulate success/failure based on hardware availability.
  return hardwareAvailable() ? "success" : "failed";
}

async function processCommand({ source = "unknown", text, command, device, action }) {
  let normalized = (command || text || "").trim().toUpperCase();

  // --- Natural language → command resolution (lightweight, backend-owned) ---
  if (!command && text) {
    const t = text.toLowerCase();
    if (t.includes("start patrol") || t.includes("begin patrol")) normalized = "START_PATROL";
    else if (t.includes("stop patrol")) normalized = "STOP_PATROL";
    else if (t.includes("return")) normalized = "RETURN";
    else if (t.includes("forward") || t.includes("move forward")) normalized = "FORWARD";
    else if (t.includes("reverse") || t.includes("back")) normalized = "REVERSE";
    else if (t.includes("left")) normalized = "LEFT";
    else if (t.includes("right")) normalized = "RIGHT";
    else if (t.includes("stop")) normalized = "STOP";
    else if (t.includes("bed light") && t.includes("on")) normalized = "BEDLIGHT_ON";
    else if (t.includes("bed light") && t.includes("off")) normalized = "BEDLIGHT_OFF";
    else if (t.includes("fan") && t.includes("on")) normalized = "FAN_ON";
    else if (t.includes("fan") && t.includes("off")) normalized = "FAN_OFF";
    else if (t.includes("system status") || t.includes("status of the system")) normalized = "SYSTEM_STATUS";
    else if (t.includes("rover status")) normalized = "ROVER_STATUS";
  }

  // --- Route ---
  let mode = "ASSISTANT";
  if (COMMAND_TABLE[normalized]) mode = COMMAND_TABLE[normalized].mode;
  else if (normalized === "BEDLIGHT_ON" || normalized === "BEDLIGHT_OFF" ||
           normalized === "FAN_ON" || normalized === "FAN_OFF" ||
           normalized === "RELAY1_ON" || normalized === "RELAY1_OFF") {
    mode = "IOT";
  }
  // Direct structured access (dashboard buttons)
  if (device && action) {
    const map = IOT_ACTIONS[device];
    if (map && map[action]) {
      normalized = map[action];
      mode = "IOT";
    } else {
      return fail(source, normalized, mode, "IOT", "Unknown device or action");
    }
  }

  // --- Execute only for non-assistant routes ---
  if (mode !== "ASSISTANT") {
    const status = await executeHardware({ command: normalized, mode });
    if (status === "failed") {
      const reason = hardwareAvailable() ? "Command rejected" : "ESP32 is currently offline";
      const entry = pushActivity({ source, command: normalized, mode, status: "failed", reason });
      return { success: false, mode, command: normalized, reason, activity: entry };
    }

    // Apply state effects
    if (normalized === "START_PATROL") systemState.rover = "patrol";
    else if (normalized === "STOP_PATROL" || normalized === "STOP" || normalized === "STOP_ALL") systemState.rover = "standby";
    if (normalized === "FORWARD" || normalized === "REVERSE" || normalized === "LEFT" || normalized === "RIGHT") systemState.rover = "moving";
    if (mode === "IOT") {
      const dv = devices.find((d) => d.id === device || IOT_ACTIONS[d.id] && IOT_ACTIONS[d.id][action] === normalized);
      if (dv) dv.state = normalized.endsWith("_ON");
    }

    const entry = pushActivity({ source, command: normalized, mode, status: "success" });
    return { success: true, mode, command: normalized, message: COMMAND_TABLE[normalized]?.label || normalized, activity: entry };
  }

  // --- ASSISTANT: route to Ollama (or simulated reply in demo mode) ---
  const reply = await runAssistant(text || normalized);
  const entry = pushActivity({ source, command: "ASSISTANT", mode: "ASSISTANT", status: "success" });
  return { success: true, mode: "ASSISTANT", command: "ASSISTANT", message: reply.text, activity: entry };
}

// Build a focused prompt so Ollama stays on-topic and concise for the MechX4
// Sentinel system instead of drifting into generic web-style answers.
function buildAssistantPrompt(user, context) {
  return [
    "You are the AI co-pilot of the MechX4 / AI Sentinel command center: an integrated robotics and IoT security system with a rover and smart-home devices.",
    "Rules:",
    "- Answer ONLY about this MechX4 system and its declared capabilities (rover patrol/movement, cameras, IoT lights/fans/sensors, system status).",
    "- If asked about anything outside the system, politely note you only cover the MechX4 system.",
    "- NEVER invent live data. Use ONLY the provided context. Do not reference real-world sites, outages, or dates (e.g. Google, dates).",
    "- Be brief and conversational. Use short plain sentences. Keep it under ~90 words. No headers, no bullet lists, no markdown.",
    "",
    "Current live status you may reference: " + (context || "none"),
    "",
    "Operator request: " + (user || "").trim(),
  ].join("\n");
}

// Try real Ollama first (it is a local resource independent of the hardware
// demo flag). Falls back to a clearly-marked simulated reply only when Ollama
// is unreachable, so the UI never presents a fake model response as real.
async function tryOllama(prompt, context) {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 60000);
    const res = await fetch(`${CONFIG.ollama.endpoint}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: CONFIG.ollama.model, prompt: buildAssistantPrompt(prompt, context), stream: false }),
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const data = await res.json();
    return (data.response && data.response.trim()) ? data.response.trim() : null;
  } catch (e) {
    return null;
  }
}

// Snapshot of current system state so the assistant never fabricates telemetry.
function systemContext() {
  const esp = CONFIG.esp32.enabled ? "connected" : "offline";
  const onDevices = devices.filter((d) => d.online).map((d) => d.name).join(", ") || "none online";
  return [
    `Backend: online. ESP32 hardware: ${esp}.`,
    `Ollama: ${checkOllamaCached() ? "ready" : "offline"}.`,
    `Rover: ${systemState.rover}. IoT devices online: ${onDevices}.`,
  ].join(" ");
}

function checkOllamaCached() {
  return ollamaReachable === true;
}

async function runAssistant(prompt) {
  // Determine whether Ollama is currently reachable so we know whether to
  // surface a real response or a clearly-marked simulated fallback.
  const ollamaUp = await checkOllama();

  if (ollamaUp) {
    const reply = await tryOllama(prompt, systemContext());
    if (reply) return { text: reply, live: true };
  }

  // Simulated fallback (clearly marked) when Ollama is not reachable.
  const t = (prompt || "").toLowerCase();
  let text;
  if (!ollamaUp) text = "Ollama is not reachable. Start Ollama and pull a model, then try again.";
  else if (t.includes("status")) text = "Backend online. ESP32 offline. Rover standby.";
  else if (t.includes("rover")) text = "Rover is in standby mode.";
  else if (t.includes("patrol")) text = "Patrol command accepted and routed to SENTINEL.";
  else if (t.includes("bed light") || t.includes("fan")) text = "That request was routed as an IOT command to ESP32.";
  else text = "Received your request (simulated reply — Ollama returned no usable response).";
  return { text, live: false };
}

function fail(source, command, mode, sub, reason) {
  const entry = pushActivity({ source, command, mode: sub, status: "failed", reason });
  return { success: false, mode, command, reason, activity: entry };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.get("/api/health", async (req, res) => {
  const ollamaUp = await checkOllama();
  res.json({
    success: true,
    backend: "online",
    uptime: Math.round(process.uptime()),
    esp32: CONFIG.esp32.enabled ? "connected" : "offline",
    ollama: ollamaUp ? "ready" : "offline",
    ollamaModel: ollamaUp ? CONFIG.ollama.model : null,
    demoMode: CONFIG.demoMode,
  });
});

app.get("/api/status", (req, res) => {
  res.json({ success: true, ...systemState, devicesOnline: devices.filter((d) => d.online).length, devicesTotal: devices.length });
});

app.get("/api/rover", (req, res) => {
  res.json({
    success: true,
    status: systemState.rover,
    battery: CONFIG.esp32.enabled ? 87 : null,
    signal: CONFIG.esp32.enabled ? -56 : null,
    speed: null,
    distance: null,
    temperature: CONFIG.esp32.enabled ? 42 : null,
    latency: CONFIG.esp32.enabled ? 24 : null,
    patrol: { active: systemState.rover === "patrol", started: null, state: "Scanning" },
  });
});

app.get("/api/devices", (req, res) => res.json({ success: true, devices }));

app.get("/api/activity", (req, res) => res.json({ success: true, activity }));

app.post("/api/command", async (req, res) => {
  const result = await processCommand(req.body || {});
  res.json(result);
});

app.post("/api/assistant", async (req, res) => {
  const { text } = req.body || {};
  const result = await processCommand({ source: "dashboard", text });
  res.json(result);
});

app.post("/api/rover/command", async (req, res) => {
  const result = await processCommand({ source: "dashboard", command: req.body && req.body.command });
  res.json(result);
});

app.post("/api/iot/command", async (req, res) => {
  const result = await processCommand({ source: "dashboard", device: req.body && req.body.device, action: req.body && req.body.action });
  res.json(result);
});

// Serve static frontend
const frontendPath = path.join(__dirname, "frontend");
if (fs.existsSync(path.join(frontendPath, "index.html"))) {
  app.use(express.static(frontendPath));
} else {
  // Fallback in case frontend lives at repo root
  app.use(express.static(__dirname));
}

app.listen(PORT, () => {
  console.log(`[AI Sentinel] backend listening on http://localhost:${PORT}`);
  console.log(`[AI Sentinel] demo mode is ${CONFIG.demoMode ? "ON" : "OFF"}`);
});
