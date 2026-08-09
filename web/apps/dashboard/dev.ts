import page from "./src/index.html";
import { mockApi } from "./mock";
const server = process.env.SERVER_URL ?? "http://localhost:4000";
// Proxy /api/* (including the /api/stream SSE) to the Express server; single origin, no CORS.
// If the server is unreachable (e.g. running the dashboard standalone with no MQTT
// secrets), fall back to the in-memory mock backend so the UI still has data.
const proxy = async (req: Request) => {
  const url = new URL(req.url);
  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.text();
  try {
    return await fetch(`${server}${url.pathname}${url.search}`, { method: req.method, headers: req.headers, body });
  } catch {
    const mockReq = new Request(req.url, { method: req.method, headers: req.headers, body });
    return (await mockApi(mockReq)) ?? new Response("Not found", { status: 404 });
  }
};
Bun.serve({ port: 3000, development: { hmr: true, console: true }, routes: { "/": page, "/api/*": proxy }, fetch() { return new Response("Not found", { status: 404 }); } });
console.log("Dashboard development server: http://localhost:3000 (proxying /api → " + server + ", mock fallback when offline)");
