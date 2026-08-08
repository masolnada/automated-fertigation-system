# Watering events persisted in SQLite behind a repository port

> **Status: partially superseded by [ADR-0009](0009-server-ingests-device-authoritative-events.md).**
> The SQLite/Drizzle store behind a repository port stands. The server-side
> pump-edge recorder and 30 s debounce described below are replaced by ingesting
> the controller's own event log.

The server records each watering event to a SQLite file via Drizzle
(`drizzle-orm/bun-sqlite`, `sqlite` dialect) behind a `WateringEventRepository`
port, so the domain stays storage-agnostic and the data is owned in-process to
enable later features (watering-frequency automations, scheduling). We chose an
embedded file over a database container to keep the dependency footprint small,
and Drizzle over raw `bun:sqlite` so the data-access code is standard SQL,
dialect-portable to Postgres later by swapping the adapter — not the domain.

## Considered options

Flow data is already captured by the separate Telegraf → InfluxDB → Grafana
stack, so a SQL store is partly redundant with it. We accept that duplication
during a phased transition: SQLite serves the app now, InfluxDB/Grafana stays
for human charting, and it is retired later with no fixed deadline. A standalone
Postgres container was rejected — for a single-writer appliance writing a few
rows a minute it adds a service, credentials, and backups against our goal of
fewer dependencies, and the repository port makes switching to it later an
adapter change rather than a rewrite.

## Consequences

- A `WateringRecorder` application service subscribes to the read-model snapshot
  and owns event detection; the `Controller` aggregate stays pure. Pump state is
  added to the snapshot (the pump switch was previously untracked).
- A watering event is a **pump-on span** (see the glossary), coalesced across the
  sequence's intra-handover pump-off gaps by a ~30s debounce.
- Rows are written on pump-on (open) and finalized on pump-off, so a mid-watering
  restart does not lose the event; startup reconciles any dangling open row.
- New persistent infrastructure: a `DB_PATH` env var and a named `hort_db`
  Docker volume. Schema evolves via drizzle-kit migrations applied on boot.
