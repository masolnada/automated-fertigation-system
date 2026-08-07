# ADR-0012 — Report every 30 minutes

**Status:** Accepted

## Context

The reporting interval sets both data resolution and battery life. It has to
match the physical timescale of what is being measured.

**Soil water tension is a slow variable.** Soil dries over hours and days, driven
by evapotranspiration. The only rapid transition is an irrigation event itself —
and that is already logged precisely by the flow sensor on the KC868-A8
(`controller/kc868-a8.yaml:562`, `docs/flow-sensor.md`), at 1-second resolution.

## Options considered

### A. 15 minutes

- **Pro:** 96 samples/day. A lost packet leaves a 15-minute gap rather than 30.
- **Pro:** Slightly better resolution of the wetting front immediately after
  irrigation.
- **Con:** Roughly double the active energy (~2.4 vs ~1.4 mAh/day).
- **Con:** Oversamples a variable that does not move meaningfully in 15 minutes.

### B. 30 minutes (chosen)

- **Pro:** 48 samples/day — ample for a quantity with a timescale of hours.
- **Pro:** Halves the wakeups relative to 15 minutes, after which the **sleep
  current floor dominates** the budget. Beyond this point, further reductions
  in wake frequency buy progressively less.
- **Pro:** Comfortably resolves the daily evapotranspiration cycle and the
  post-irrigation drainage curve, which are the shapes the data exists to reveal.
- **Con:** A lost packet costs a 30-minute gap. On an unacknowledged link
  ([ADR-0002](0002-lora-only-topology.md)) some losses are expected.

### C. 60 minutes

- **Pro:** Halves active energy again.
- **Con:** **Saves almost nothing.** At 30 minutes the budget is already near
  the sleep floor, so halving wakeups again yields a marginal improvement in
  battery life — perhaps a few months across a multi-year lifetime.
- **Con:** Makes any single packet loss conspicuous: a two-hour gap in a Grafana
  panel looks like a fault, prompting investigation of a non-problem.

### D. Adaptive interval (frequent while wet, sparse while dry, or triggered by change)

- **Pro:** In principle the best data-per-joule.
- **Con:** Substantially more firmware complexity in a device with no OTA
  ([ADR-0002](0002-lora-only-topology.md)) — a bug means a field visit.
- **Con:** Irregular sampling complicates every downstream query and chart.
- **Con:** Solves an energy problem that does not exist. The battery already
  outlasts the sensors' service interval.

## Decision

**30 minutes**, fixed. 48 readings per day.

## Consequences

- Power budget: ~1.4 mAh/day, ~0.5 Ah/year, giving **3+ years** on 3 AA lithium
  cells ([ADR-0009](0009-aa-lithium-battery.md)).
- The gateway's stale detection uses **three missed reports (~90 minutes)**
  before declaring the node offline
  ([ADR-0003](0003-a8-as-gateway.md)). One missed packet on an unacknowledged
  link is normal and must not raise an alarm.
- **No retransmission and no acknowledgement.** A lost packet is simply a gap.
  Acceptable for this variable; adding ACKs would require a receive window on
  the node, keeping the radio and MCU awake and costing more energy than the
  data is worth.
- Any future MQTT automation must tolerate **stale-by-up-to-30-minutes** data
  and occasional gaps. It should act on a recent *trend*, not on a single
  reading, and should refuse to act on data older than ~90 minutes.
- Changing the interval is a one-line change on the node (`deep_sleep`
  `sleep_duration`) plus the gateway's stale threshold. Since it requires
  physical access to flash, choose deliberately now rather than planning to
  tune later.
