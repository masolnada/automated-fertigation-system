# ADR-0009 — 3× AA lithium primary cells, no solar

**Status:** Accepted
**Supersedes:** an earlier working assumption of a single 18650 Li-ion cell

## Context

The node must run unattended for as long as possible in **Cardona**, inland
Catalonia at roughly 500 m altitude. That means hard frosts, nights at −5 to
−10 °C, and periods of sustained sub-zero temperature — not the mild coastal
winter first assumed.

The measured load is small. From the power budget in `../README.md`:
approximately **1.4 mAh per day**, or **~0.5 Ah per year**, dominated as much by
sleep current as by activity.

When consumption is this low, the constraints are not what they usually are:
self-discharge, calendar ageing and cold-temperature behaviour matter more than
capacity.

## Options considered

### A. 3× AA lithium primary, Energizer L91 (chosen)

Lithium iron disulfide chemistry, ~1.8 V open circuit, ~1.5 V nominal.

- **Pro:** **Rated −40 to +60 °C.** A Cardona winter is simply outside the range
  of conditions that affect them. This is the decisive property.
- **Pro:** ~3000 mAh at ~4.5 V nominal — roughly **1.6× the energy** of the
  18650 originally considered.
- **Pro:** **~1 %/year self-discharge and a 20-year shelf life.** At a 0.5 Ah/yr
  load, self-discharge is a meaningful fraction of total consumption, so this is
  not a footnote.
- **Pro:** No charging circuit, no protection board, no thermal risk in a sealed
  enclosure, nothing to fail.
- **Pro:** Replaceable anywhere, with no tools.
- **Con:** Not rechargeable. In practice irrelevant: replacement is expected
  roughly every three years, which is *less often* than an ageing Li-ion would
  need replacing anyway.
- **Con:** Higher cost per cell, and three of them.
- **Con:** A 3-cell holder takes more board area than a single 18650.

### B. Single 18650 Li-ion (originally proposed, rejected)

- **Pro:** High capacity in one cell, rechargeable, compact.
- **Con:** **Cold performance is the problem.** At −10 °C internal resistance
  rises several-fold and usable capacity falls 20–40 %. The 45 mA LoRa transmit
  peak then sags the terminal voltage exactly when it matters, producing the
  classic and thoroughly miserable field fault: *the node goes quiet on cold
  nights and works again by noon.*
- **Con:** Calendar ageing means year-two capacity is noticeably below year-one.
- **Con:** Charging below 0 °C causes permanent lithium plating, so any solar
  option would need temperature-gated charging — a problem this project already
  documents for the main system battery.

### C. LiFePO4 (e.g. 14500 or 18650 format)

- **Pro:** Better cold tolerance than Li-ion, very long cycle life, and 3.2 V
  nominal is temptingly close to 3.3 V.
- **Con:** The apparent advantage — skipping the regulator — is illusory. A
  fully charged cell sits at 3.6 V, which is at or above the ESP32-C3's absolute
  maximum. A regulator is needed regardless, and with it the advantage
  disappears.
- **Con:** Still must not be charged below 0 °C.

### D. Adding solar

- **Pro:** In principle indefinite runtime.
- **Con:** **The load is 1.4 mAh/day.** A panel, a charge controller and its
  quiescent draw, plus wiring, mounting and a whole new failure surface, to
  service a load that three AA cells cover for years. The charge controller's
  own idle current would likely exceed the node's consumption.
- **Con:** Sub-zero charging protection would be needed, adding a temperature
  sensor and switching logic to the power path.
- **Con:** Panels get dirty, shaded and stolen. The main system already has
  solar because it runs a 3.5 A pump; this node does not.

## Decision

**Three AA lithium primary cells (Energizer L91 or equivalent) in series, no
solar.** Expected life **3+ years**.

## Consequences

- The pack sits at **5.4 V fresh** and stays flat near 4.4 V for most of its
  life. Well within the TPS7A02's 6 V input rating
  ([ADR-0010](0010-tps7a02-ldo.md)).
- With ~100 mV dropout, regulation holds down to about **3.4 V pack voltage —
  roughly 1.13 V per cell**, past the point where an L91 has anything useful
  left. **Essentially the full capacity is usable**, which is not true of most
  battery/regulator combinations.
- **Battery voltage must be transmitted** with every reading. Lithium primaries
  hold a notoriously flat discharge curve and then fall off sharply, so the
  useful signal is the *trend over weeks*, not the instantaneous value. Without
  it, the first sign of an exhausted battery is silence.
- The sense divider is **MOSFET-gated** so it draws nothing while asleep. A
  permanently connected 1.5 MΩ divider would draw ~3.6 µA — around a quarter of
  the entire sleep budget, spent on a measurement taken twice an hour.
- **Do not mix old and new cells**, and replace all three together. Series
  primaries can reverse-charge a weak cell.
- The enclosure and cable glands must be rated for the same cold. Condensation
  cycling in and out of freezing is what actually destroys field boxes; include
  a breather membrane and silica gel.
- Cells should be swapped on a schedule informed by the voltage trend, not run
  to exhaustion — a dead node is invisible except through the gateway's stale
  sensor ([ADR-0003](0003-a8-as-gateway.md)).
