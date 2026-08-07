# Realtime is a full snapshot per SSE event, coalesced per tick

State reaches the browser as SSE (server→browser), not polling or WebSocket, and
each event carries the *entire* snapshot rather than deltas; the server coalesces
bursts (e.g. retained-message replay) to one snapshot per tick. A full snapshot
makes reconnect self-healing — a fresh EventSource just gets the current truth —
and the device is a single small aggregate, so the payload is cheap. Mutations go
the other way as react-query HTTP commands.
