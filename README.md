# AI Sentinel / MechX4 — Command Center

The web dashboard and Node.js backend for an integrated AI + robotics + IoT security
platform. This project is the **control center**, not the hardware controller.

## Architecture

```
              USER INTERFACES
      ┌─────────────┼─────────────┐
      │             │             │
  Dashboard      Voice       Telegram
      │             │             │
      └─────────────┼─────────────┘
                    ▼
             NODE.JS / EXPRESS
                    │
             processCommand()
                    │
            COMMAND VALIDATION
                    │
         ┌──────────┼──────────┐
         ▼          ▼          ▼
     SENTINEL      IOT      ASSISTANT
         │          │          │
         ▼          ▼          ▼
       ESP32      ESP32      OLLAMA
         │          │
         ▼          ▼
       ROVER      DEVICES
```

**Key principle:** every interface (dashboard, voice, telegram) sends structured
requests to the backend. The backend's `processCommand()` layer classifies,
validates, and executes commands. The frontend **never** directly controls
ESP32 GPIO and never gives Ollama direct hardware authority.

## Repository layout

```
.
├── server.js            # Express backend + central command router
├── package.json
├── frontend/            # Vanilla HTML/CSS/JS single-page app
│   ├── index.html
│   ├── css/             # main (themes), layout, components, responsive
│   └── js/
│       ├── commands.js  # shared command vocabulary
│       ├── state.js     # centralized app state
│       ├── eventbus.js  # pub/sub (future WebSocket/SSE)
│       ├── api.js       # single API abstraction + mock adapter
│       ├── router.js    # hash-based SPA navigation
│       ├── ui.js        # shared components + command pipeline
│       ├── notifications.js
│       ├── dashboard.js # overview
│       ├── sentinel.js  # rover control
│       ├── iot.js       # IoT / GPIO
│       ├── assistant.js # AI chat
│       ├── activity.js  # command log
│       ├── devices.js
│       ├── health.js
│       ├── settings.js
│       └── app.js       # bootstrap, top bar, clock, emergency stop
└── README.md
```

## Running

```bash
npm install
npm start          # serves frontend + API on http://localhost:3000
```

If port 3000 is already in use, set a different port:

```bash
PORT=3001 npm start
```

## Demo / Mock mode

The frontend runs in **DEMO MODE** by default when no backend URL is configured.
In demo mode:

- The UI shows a clearly visible **DEMO MODE** badge.
- Mock telemetry is isolated inside `js/api.js` (the `mock` adapter).
- Unavailable hardware shows empty states (`--`, `Awaiting sensor data`),
  never fabricated numbers.

## Connecting a real backend

1. Open **Settings** and set **Backend URL** (e.g. `http://localhost:3000`).
2. Save — the app reconnects and switches from DEMO to LIVE when the backend
   is reachable. If the backend becomes unreachable it falls back to DEMO.

All networking goes through `frontend/js/api.js`. Endpoint URLs live only
there, so they are trivial to change.

## API contract

| Method | Endpoint            | Purpose                                  |
| ------ | ------------------- | ---------------------------------------- |
| GET    | `/api/health`       | Uptime, service connectivity             |
| GET    | `/api/status`       | Overall system status, mode, demo flag   |
| GET    | `/api/rover`        | Rover status, telemetry, patrol          |
| GET    | `/api/devices`      | Device inventory                         |
| GET    | `/api/activity`     | Recent command/activity log              |
| POST   | `/api/command`      | **Canonical**: route any command         |
| POST   | `/api/assistant`    | Natural-language message to router       |
| POST   | `/api/rover/command`| Rover command shortcut                   |
| POST   | `/api/iot/command`  | Structured device action (`device`+`action`) |

### POST /api/command

All dashboard commands go here. Body:

```json
{ "source": "dashboard", "command": "START_PATROL" }
```

Natural language (assistant) uses `text` instead of `command`:

```json
{ "source": "dashboard", "text": "Turn on the bed light" }
```

Response shape:

```json
{
  "success": true,
  "mode": "SENTINEL",
  "command": "START_PATROL",
  "message": "Start Patrol",
  "activity": { "timestamp": "...", "source": "dashboard", "command": "START_PATROL", "mode": "SENTINEL", "status": "success" }
}
```

On failure:

```json
{ "success": false, "mode": "IOT", "command": "BEDLIGHT_ON", "reason": "ESP32 is currently offline" }
```

### Command vocabulary (shared by dashboard / voice / telegram)

`START_PATROL`, `STOP_PATROL`, `RETURN`, `FORWARD`, `REVERSE`, `LEFT`, `RIGHT`,
`STOP`, `STOP_ALL`, `LIGHTS_ON`, `LIGHTS_OFF`, `MODE_AUTO`, `MODE_MANUAL`,
`BEDLIGHT_ON`, `BEDLIGHT_OFF`, `FAN_ON`, `FAN_OFF`, `RELAY1_ON`, `RELAY1_OFF`,
`SYSTEM_STATUS`, `ROVER_STATUS`.

## Configuration (server, via environment variables)

| Variable            | Default                | Purpose                            |
| ------------------- | ---------------------- | ---------------------------------- |
| `PORT`              | `3000`                 | HTTP port                          |
| `MECHX4_DEMO`       | `1`                    | `0` disables demo assistant        |
| `ESP32_ENABLED`     | (unset)                | `1` marks ESP32 connected          |
| `ESP32_HOST`        | `192.168.1.100`        | ESP32 IP / host                    |
| `ESP32_PORT`        | `80`                   | ESP32 HTTP port                    |
| `OLLAMA_ENDPOINT`   | `http://127.0.0.1:11434` | Ollama API endpoint             |
| `OLLAMA_MODEL`      | `llama3`               | Ollama model                       |

> **Security:** never store backend secrets in client-side code. Configure
> secrets via environment variables on the server.

## Real-time (future)

The frontend is architected to accept WebSocket / Server-Sent Events without
rewrites. Subscribe to updates via the event bus (`frontend/js/eventbus.js`):

```js
EventBus.on("rover:update", ...)
EventBus.on("system:update", ...)
EventBus.on("alert", ...)
EventBus.on("activity:update", ...)
```

## Themes

Multiple dark and light themes are available under **Settings → Appearance**
(dark, graphite, dark-amber, light, slate, light-green). The preference is
persisted in the browser.

## Implementation phases compatibility

This build targets the phased roadmap (backend → command router → Ollama →
ESP32 rover → IoT → dashboard → voice → telegram → sensors → camera).
Tabs that depend on unimplemented hardware show placeholder/empty states and
are explicitly marked `NOT CONNECTED` / `COMING SOON` rather than invented.
