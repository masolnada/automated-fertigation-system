# Hort web dashboard

Bun workspace containing the fertigation dashboard and its server. The browser no
longer speaks MQTT — an Express server (running on Bun) is the only MQTT client.
It owns all device communication, keeps an in-memory snapshot, streams it to the
browser over SSE, and accepts commands over HTTP.

- `apps/server`: Express on Bun — the only MQTT client (DDD / hexagonal). Owns
  device I/O, the read model, SSE (`GET /api/stream`), and command endpoints
  (`POST /api/commands/*`).
- `apps/dashboard`: React/TypeScript static app. Consumes SSE via
  `useSyncExternalStore` and issues commands with react-query `useMutation`.
- `packages/contracts`: shared wire types (`@hort/contracts`).
- `packages/ui`: dashboard primitives and the e-ink theme.

## Development

```sh
cp .env.example .env # enter broker values
bun install
bun run dev        # starts BOTH the Express server (:4000) and the dashboard (:3000)
bun run typecheck
bun test
bun run build      # builds the static dashboard into apps/dashboard/dist
podman build -t hort-dashboard -f apps/dashboard/Containerfile .
podman build -t hort-server -f apps/server/Containerfile .
```

The dashboard dev server proxies `/api/*` (including the SSE stream) to the
Express server, so the browser talks to a single origin with no CORS.

## Environment (server-only)

These are read by `apps/server` at boot and are **never** sent to the browser.

| Variable | Description |
|---|---|
| `MQTT_URL` | MQTT broker URL (e.g. `mqtt://host:1883`) |
| `MQTT_USERNAME` | MQTT username |
| `MQTT_PASSWORD` | MQTT password |
| `MQTT_PREFIX` | Device topic prefix (normally `kc868-a8`) |
| `PORT` | Express server port (default `4000`) |

## Deployment (two containers)

1. **nginx** serving the static `dist/` from `apps/dashboard/Containerfile`.
2. **Express server** from `apps/server/Containerfile`.

nginx proxies `/api` to the server with **`proxy_buffering off`** so SSE is
delivered incrementally, e.g.:

```nginx
location /api/ {
  proxy_pass http://hort-server:4000;
  proxy_buffering off;
  proxy_http_version 1.1;
  proxy_set_header Connection "";
}
```

Compose/vhost/env wiring lives in the separate homelab repo.
