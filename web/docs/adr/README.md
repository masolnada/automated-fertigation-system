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
| [0010](0010-zone-names-are-server-owned-and-temporal.md) | Zone names are server-owned and resolved as of the event that used them (superseded by 0015) |
| [0011](0011-paper-theme-is-aesthetic-not-hardware.md) | The paper theme is an aesthetic choice, not an e-ink hardware constraint (single-theme claim amended by 0013) |
| [0012](0012-confirmations-are-native-top-layer-dialogs.md) | Confirmations are native top-layer `<dialog>` elements |
| [0013](0013-dark-is-a-mode-not-a-second-theme.md) | Dark is a mode of the paper theme, chosen by a client-persisted toggle |
| [0014](0014-output-channels-are-generic-zones-are-server-entities.md) | Output channels are generic; a Zone is a server-owned entity assigned to one |
| [0015](0015-zone-names-are-current-only.md) | Zone names are current-only; renaming relabels history (supersedes 0010) |
| [0016](0016-the-dashboard-speaks-zones-not-channels.md) | The dashboard speaks zones; the output channel is a firmware concept |
| [0017](0017-schedules-are-server-authored-and-device-fired.md) | Schedule entries are authored and stored here, and fired by the controller |
| [0018](0018-zone-colours-are-permanent-reserved-identities.md) | Zone colours are permanent palette identities reserved through archiving (superseded by 0019) |
| [0019](0019-zone-colours-are-a-client-side-aid.md) | Zone colours are a disposable client-side aid, kept in `localStorage` (supersedes 0018) |
