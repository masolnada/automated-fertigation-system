import { GlobalRegistrator } from "@happy-dom/global-registrator";
// Server tests set NO_DOM=1: they must run without a global `window`/`WebSocket`,
// otherwise mqtt.js caches a browser environment and refuses TCP connections.
if (process.env.NO_DOM !== "1" && !GlobalRegistrator.isRegistered) GlobalRegistrator.register();
