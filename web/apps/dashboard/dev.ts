import page from "./src/index.html"; import { parseConfig } from "@hort/mqtt";
const config = () => parseConfig({ brokerUrl: process.env.MQTT_URL, username: process.env.MQTT_USERNAME, password: process.env.MQTT_PASSWORD, prefix: process.env.MQTT_PREFIX ?? "kc868-a8" });
Bun.serve({ port: 3000, development: { hmr: true, console: true }, routes: { "/": page, "/config.json": () => Response.json(config()) }, fetch() { return new Response("Not found", { status: 404 }); } });
console.log("Dashboard development server: http://localhost:3000");
