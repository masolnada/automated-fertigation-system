# The server ingests device-authoritative watering events; it does not detect them

The server stops deriving watering events from pump-state edges and instead
ingests the controller's own durable event log: it subscribes to the retained
`watering/log`, inserts any event whose `(device_id, seq)` it hasn't seen, and
stores the device's values verbatim (RTC epoch `start`/`end`, `litres`,
`outcome`, `trigger`, `channel`). `avg_flow` is derived at read time. This makes
the controller the single source of truth (controller ADR-0012), which is the
only way to capture waterings that happen while the controller is offline in the
field — the exact case the previous server-side detection missed.

Supersedes ADR-0008's server-side pump-edge recorder and 30 s debounce, which are
removed. Because no real history had accumulated, the `watering_events` table is
recreated in the new shape by a destructive migration rather than an in-place
alter. The `GET /api/watering-events` endpoint and the dashboard panel are kept,
now reading the new columns.

## Consequences

- The one `(device_id, seq)` dedup handles live, reconnect backfill, and broker
  restart identically — no timers, no debounce, no second producer.
- Observability keeps a separate best-effort feed: Telegraf consumes the
  non-retained `watering/event` topic, never the retained array.
