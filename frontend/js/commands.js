/**
 * commands.js — central command vocabulary.
 *
 * Every interface (dashboard, voice, telegram) shares this vocabulary.
 * The frontend does NOT decide routing independently; it only maps UI
 * actions to canonical command tokens. The backend processCommand()
 * layer performs classification, validation and execution.
 */
window.COMMANDS = {
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
  BEDLIGHT_ON: { mode: "IOT", label: "Bed Light On" },
  BEDLIGHT_OFF: { mode: "IOT", label: "Bed Light Off" },
  FAN_ON: { mode: "IOT", label: "Fan On" },
  FAN_OFF: { mode: "IOT", label: "Fan Off" },
  RELAY1_ON: { mode: "IOT", label: "Relay On" },
  RELAY1_OFF: { mode: "IOT", label: "Relay Off" },
  LIGHTS_ON_IOT: { mode: "IOT", label: "Lights On" },
  SYSTEM_STATUS: { mode: "ASSISTANT", label: "System Status" },
  ROVER_STATUS: { mode: "ASSISTANT", label: "Rover Status" },
};

window.commandLabel = function (token) {
  const c = COMMANDS[token];
  return c ? c.label : token;
};
