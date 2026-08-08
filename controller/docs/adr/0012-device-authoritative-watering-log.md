# The controller is the authoritative source of watering events

The controller records every completed watering to a durable on-device ring
buffer and publishes it over MQTT; the server ingests and stores but no longer
derives events. This exists because the controller is portable and spends weeks
in the field with no WiFi — deriving events server-side from live pump-state
edges silently loses every watering that happens while offline, which is the
normal case, not the exception.

A watering event is one pump-on span, bracketed on-device by a `handover` flag so
the sequence's deliberate mid-run pump-off/on transitions don't split it (no
timing debounce — the firmware knows its own handovers). Events are
completion-only: one durable entry per finished watering. Each carries a durable
monotonic `seq` (the dedup and gap-detection key), RTC epoch `start`/`end`,
`litres` (the `total_water` delta), `outcome`
(`completed | aborted | dry_run | recovery`), `trigger` (`manual | sequence`),
and reserved `channel` / `device_id` for future multi-zone / multi-device.

## Considered options

Server-side detection from pump-state MQTT edges (the prior model, web ADR-0008)
was rejected because it cannot see events that occur while the controller is
disconnected; only the aggregate `total_water` counter survives an outage, not
the per-event history the frequency/scheduling automations need. Making the
device authoritative also deletes the server's debounce heuristic and gives exact
boundaries and litres.

## Consequences

- Two MQTT topics: `watering/log` (retained ring-buffer array — the server's
  gap-free source, deduped by `(device_id, seq)`) and `watering/event`
  (non-retained per-event object — best-effort for observability; a re-sent
  retained array would double-count in InfluxDB).
- The ring buffer lives in ESP32 NVS at N=192 (ADR-0011); overflow is bounded and
  detectable via `seq` gaps, with aggregate litres recoverable from `total_water`.
- Accurate offline timestamps require an on-device clock (ADR-0013).
- Live "in progress" status remains a read-model/snapshot concern, never the log.
