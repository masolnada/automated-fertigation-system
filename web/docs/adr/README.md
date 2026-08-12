# Architecture Decision Records — Web

Decisions for the dashboard and its server (`web/`). Each record is one decision
in 1–3 sentences. See [../../CONTEXT.md](../../CONTEXT.md) for the glossary.

| # | Decision |
|---|---|
| [0001](0001-bun-react-monorepo.md) | Bun/React/TS/Tailwind monorepo under `web/` |
| [0002](0002-eink-design-constraint.md) | The paper design system is a hard constraint (rationale superseded by 0011) |
| [0003](0003-server-owns-mqtt.md) | The server owns MQTT; the browser gets SSE + intent commands |
| [0004](0004-full-snapshot-coalesced-sse.md) | Realtime is a full snapshot per SSE event, coalesced per tick |
| [0005](0005-contracts-vs-display-split.md) | Wire types are shared; display metadata stays client-side |
| [0006](0006-synchronous-guarded-reset.md) | Total Water reset is a synchronous HTTP command |
| [0007](0007-two-container-deployment.md) | Two-container deployment: nginx static + Express server |
| [0008](0008-watering-events-sqlite-repository.md) | Watering events in SQLite (Drizzle) behind a repository port |
| [0009](0009-server-ingests-device-authoritative-events.md) | Server ingests device-authoritative events (supersedes 0008's detector) |
| [0010](0010-zone-names-are-server-owned-and-temporal.md) | Zone names are server-owned and resolved as of the event that used them |
| [0011](0011-paper-theme-is-aesthetic-not-hardware.md) | The paper theme is an aesthetic choice, not an e-ink hardware constraint |
| [0012](0012-confirmations-are-native-top-layer-dialogs.md) | Confirmations are native top-layer `<dialog>` elements |
