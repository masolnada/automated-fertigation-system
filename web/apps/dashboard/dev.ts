import page from "./src/index.html";
const server = process.env.SERVER_URL ?? "http://localhost:4000";
// Proxy /api/* (including the /api/stream SSE) to the Express server; single origin, no CORS.
const proxy = (req: Request) => { const url = new URL(req.url); return fetch(`${server}${url.pathname}${url.search}`, { method: req.method, headers: req.headers, body: req.method === "GET" || req.method === "HEAD" ? undefined : req.body, duplex: "half" } as RequestInit); };
Bun.serve({ port: 3000, development: { hmr: true, console: true }, routes: { "/": page, "/api/*": proxy }, fetch() { return new Response("Not found", { status: 404 }); } });
console.log("Dashboard development server: http://localhost:3000 (proxying /api → " + server + ")");
