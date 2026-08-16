# Context Map

This repository holds one physical system split into four bounded contexts. MQTT
is the integration backbone: every context that exchanges live data does so
through the broker, never by calling another context directly.

## Contexts

- [Fertigation Controller](./controller/CONTEXT.md) — the KC868-A8 firmware
  (`controller/kc868-a8.yaml`). Runs the irrigation sequence, meters flow, and
  publishes device state. Decisions in
  [`controller/docs/adr/`](./controller/docs/adr/). Also acts as the LoRa gateway
  for the soil node.
- [Web](./web/CONTEXT.md) — the operator dashboard and the server that fronts
  the device (`web/`). Decisions in [`web/docs/adr/`](./web/docs/adr/).
- [Observability](./observability/CONTEXT.md) — Telegraf/InfluxDB/Grafana
  metrics and history (`observability/`). Decisions in
  [`observability/docs/adr/`](./observability/docs/adr/).
- [Soil Node](./soil-node/CONTEXT.md) — the battery LoRa soil-tension logger
  (`soil-node/`). Decisions in [`soil-node/adr/`](./soil-node/adr/).

## Relationships

- **Controller ↔ Web**: the controller publishes state and subscribes to
  command topics over MQTT. The web server is the only MQTT client on that side;
  the browser reaches the device only through the server (SSE for state, HTTP for
  commands). See [web ADR-0003](./web/docs/adr/0003-server-owns-mqtt.md) and
  [controller ADR-0001](./controller/docs/adr/0001-three-phase-self-terminating-sequence.md).
- **Web → Controller (schedules)**: scheduled irrigations are authored and stored
  on the server but *executed* by the controller, from its own RTC. The server
  publishes the whole set retained on `schedule/set`; the device holds a copy in
  NVS and fires from it with no network. The split exists because the controller
  spends weeks in the field disconnected, which is exactly when the schedule must
  still run. See
  [web ADR-0017](./web/docs/adr/0017-schedules-are-server-authored-and-device-fired.md)
  and
  [controller ADR-0018](./controller/docs/adr/0018-the-controller-schedules-and-the-recipe-travels-with-the-run.md).
- **Controller → Observability**: the controller publishes flow, total-water and
  event topics; Telegraf ingests them into InfluxDB for Grafana.
- **Soil Node → Controller → Observability**: the node transmits readings by LoRa
  to the controller (the gateway), which republishes them to MQTT for
  Observability. The node makes no irrigation decisions
  ([soil-node ADR-0001](./soil-node/adr/0001-logging-only-scope.md)).

Root [`docs/adr/`](./docs/adr/) carries only system-wide decisions (currently just
ADR-0001, the MQTT backbone). Each context keeps its own decisions under its own
directory.
