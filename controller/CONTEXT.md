# Fertigation Controller

The KC868-A8 firmware (`controller/kc868-a8.yaml`): it waters the crop while injecting a
fertigation substance, meters the water, and publishes device state over MQTT.
This is the safety-critical core of the system — it drives the pump and valves.

## Language

### Irrigation

**Irrigation sequence**:
The one automation that waters. It runs three phases and always shuts itself
down; there is no state in which it ends with the pump running.
_Avoid_: cycle (reserve for the totals), program, schedule.

**Phase**:
One leg of the sequence: Pre-wet, Fertigation, or Flush.

**Pre-wet**:
First phase — clean water only, to prime the lines so the biology lands on moist
soil.

**Fertigation**:
Second phase — water carrying the fertigation substance.

**Flush**:
Final phase — clean water, always time-based, never below one minute, to clear
humate and micro-organism residue from pump, lines and emitters.

**Fertigation substance**:
Humic acid (e.g. potassium humate) plus micro-organisms injected into the supply
during the Fertigation phase.
_Avoid_: nutrients, fertilizer.

**Cycle Mode**:
Whether the cycle total is expressed in Time or Volume.

**Cycle total**:
The single size of one cycle — `Cycle Minutes` (Time) or `Cycle Liters`
(Volume). Both are retained independently across mode switches.

**Pre-wet Percent**:
The share of the cycle total given to Pre-wet (5% steps); Fertigation gets the
remainder. There is no fertigation-percent entity, so the split cannot be made
inconsistent.

**abort_irrigation**:
The single shared stop path: stop the sequence, pump off, wait 2 s, both valves
off. Used by the stop button, the MQTT stop topic, and every stop-dead watchdog
case.

### Flow and safety

**Fertigation valve / Clean water valve**:
The two 12 V electrovalves. Valve handovers overlap 2 s and the pump stops before
the last valve closes, so a running pump always has an open source.

**Min Flow watchdog**:
The 1 s loop that trips when metered flow stays below the runtime `Min Flow`
threshold past the priming grace. Its response is phase-aware.

**Recovery flush**:
The watchdog's response to low flow *during Fertigation* (an empty fertigation
tank): switch to clean water and run a full Flush, then shut down. Low flow in
any other phase stops dead instead.

**Dry run**:
Pump running with no water moving. Published to `flow/dry_run` on every watchdog
trip.

**Total Water**:
Cumulative litres metered since the last reset. Persists across normal reboots;
resetting it is irreversible and is written to preferences before success is
reported.
_Avoid_: lifetime total, odometer.

**Flow K-factor**:
Pulses per litre for the YF-B5 sensor. Runtime-adjustable so the unit can be
calibrated without reflashing; this unit measured 387 against the 396 nominal.

### Battery

**SmartShunt**:
The Victron battery monitor, read passively over AES-encrypted BLE
advertisements — no pairing, no wiring, read-only. Exposes voltage, current, SoC,
consumed Ah and time remaining.

**Battery Charged**:
Binary sensor mirroring the MPPT charge-cycle completion; publishes to
`battery/charged` on the transition.
