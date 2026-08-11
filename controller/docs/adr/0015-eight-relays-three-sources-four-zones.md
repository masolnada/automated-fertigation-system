# The relay budget fixes the system at three sources and four zones

The KC868-A8 has exactly 8 relays, and the topology consumes all of them: one
pump, three sources (Clean Water, Fertigation, Microbiology) and four zones. Four
zones — not the five originally wanted — is a direct consequence of that budget;
there is no spare relay left.

## Considered options

A second PCF8574 on the free I2C bus (the expanders sit at `0x24`/`0x22`, and the
part supports 8 addresses) would have allowed five or more zones and left real
headroom. It was rejected for now to avoid a second relay board, its wiring and
its enclosure space. Dropping to two sources would also have freed a relay, but
the third source is a real tank of micro-organisms kept separate from the humate.

## Consequences

- Adding a fifth zone is no longer a firmware change: it needs the second
  expander. Treat the zone count as hardware-fixed, not configurable.
- Nothing is left for a tank float switch or pump current sensing on the relay
  side; both were named in the README as candidate safety inputs, and both must
  now use the digital input terminals or the I2C bus instead.
