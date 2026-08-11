# Hort web dashboard

Bun workspace containing the fertigation dashboard and its server. The browser no
longer speaks MQTT — an Express server (running on Bun) is the only MQTT client.
It owns all device communication, keeps an in-memory snapshot, streams it to the
browser over SSE, and accepts commands over HTTP.

- `apps/server`: Express on Bun — the only MQTT client (DDD / hexagonal). Owns
  device I/O, the read model, SSE (`GET /api/stream`), command endpoints
  (`POST /api/commands/*`), and watering-event history in SQLite via Drizzle
  (`GET /api/watering-events` and half-open ranged `GET /api/watering-history?since=<ISO>&until=<ISO>`) —
  **ingested** from the controller's authoritative `watering/log`, deduped by
  `(device_id, seq)`. See
  [ADR-0009](docs/adr/0009-server-ingests-device-authoritative-events.md).
- `apps/dashboard`: React/TypeScript static app. Consumes SSE via
  `useSyncExternalStore` and issues commands with react-query `useMutation`.
- `packages/contracts`: shared wire types (`@hort/contracts`).
- `packages/ui`: dashboard primitives (including the reusable system `Schematic`) and the paper theme.

## Development

```sh
cp .env.example .env # enter broker values
bun install
bun run dev        # starts BOTH the Express server (:4000) and the dashboard (:3000)
bun run typecheck
bun test
bun run build      # builds the static dashboard into apps/dashboard/dist
podman build -t hort-dashboard -f apps/dashboard/Containerfile.caddy .
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
| `DB_PATH` | SQLite file for watering-event history (default `./data/hort.db`) |

## Deployment

Self-contained under [`../deploy/`](../deploy/): a Tailscale-only **Caddy**
terminates TLS (Cloudflare DNS-01) and path-splits the single origin — `/api/*`
→ `hort-server:4000` (SSE unbuffered via `flush_interval -1`), everything else
→ the static dashboard (Caddy `file_server`). Two images built from this
workspace:

1. static dashboard — `apps/dashboard/Containerfile.caddy`
2. server — `apps/server/Containerfile`

Credentials are server-only env; the browser only ever talks to `/api/*`. See
[`../deploy/README.md`](../deploy/README.md) for the full stack (dedicated
broker, Tailscale, age secrets, bootstrap).
