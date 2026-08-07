# The server owns MQTT; the browser gets SSE and intent commands

A single Express-on-Bun server is the only MQTT client: it folds device topics
into a read-model snapshot, streams it to browsers over SSE, and accepts
intent-named commands over HTTP. The browser makes zero MQTT connections. This
moves domain logic and credentials server-side, keeps the browser dumb and
sensitive-config-free, and lets the server enforce every guard.

## Considered options

The browser previously spoke MQTT-over-WebSocket directly, which exposed broker
credentials to the client and scattered domain rules there. The server is built
hexagonal (domain / application / infrastructure, deps pointing inward; MQTT and
Express are adapters behind ports) with **light** CQRS only — intent-named
command/query handlers and a thin dispatch function, no bus, no event sourcing,
no second datastore. The whole system is one physical device, modelled as one
aggregate.
