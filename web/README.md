# Hort web dashboard

Bun workspace containing the browser-only MQTT dashboard.

- `apps/dashboard`: React/TypeScript static app and nginx container definition.
- `packages/mqtt`: framework-free config, topics, state store, and safety guards.
- `packages/ui`: dashboard primitives and the e-ink theme.

## Development

```sh
cp .env.example .env # enter broker values
bun install
bun run dev
bun run typecheck
bun test
bun run build
podman build -t hort-web -f apps/dashboard/Containerfile .
```

| Variable | Description |
|---|---|
| `MQTT_URL` | WebSocket MQTT URL |
| `MQTT_USERNAME` | MQTT username |
| `MQTT_PASSWORD` | MQTT password |
| `MQTT_PREFIX` | Device topic prefix (normally `kc868-a8`) |

`config.json` is rendered by nginx at container startup. Its browser-readable MQTT credentials are acceptable only for a LAN/Tailscale deployment; treat the dashboard URL with the same trust as the broker.
