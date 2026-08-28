/**
 * eventbus.js — tiny pub/sub used for future real-time updates
 * (WebSocket / Server-Sent Events) and internal state-change signalling.
 *
 * Future integration: when the backend pushes rover:update, system:update
 * or alert events, route them through this bus so page modules can react
 * without coupling.
 */
(function () {
  const listeners = {};

  window.EventBus = {
    on(event, fn) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(fn);
    },
    off(event, fn) {
      if (!listeners[event]) return;
      listeners[event] = listeners[event].filter((f) => f !== fn);
    },
    emit(event, payload) {
      if (!listeners[event]) return;
      listeners[event].slice().forEach((fn) => {
        try {
          fn(payload);
        } catch (e) {
          // Never let one subscriber break the bus
        }
      });
    },
  };
})();
