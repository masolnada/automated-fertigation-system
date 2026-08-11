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

**Zone run**:
One irrigation sequence, which waters exactly one zone from start to finish.
Watering several zones means starting the sequence again on each.

**Fertigation substance**:
Humic acid (e.g. potassium humate) injected into the supply during the
Fertigation phase, drawn from the Fertigation source.
_Avoid_: nutrients, fertilizer.

**Microbiology source**:
A third source holding micro-organisms, kept separate from the humate so the two
can be dosed independently. Relay-backed and manually selectable; the irrigation
sequence does not yet open it.

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

### Channels

**Source**:
An upstream 12 V electrovalve selecting what the pump draws — Clean Water,
Fertigation, or Microbiology. Exactly one is open at a time. Which source is
which is fixed in firmware, because the Flush and Recovery flush depend on
knowing which one is clean water.
_Avoid_: input, input channel — the board's `a8-input*` dry-contact terminals
already own that word.

**Zone**:
A downstream 12 V electrovalve feeding one watered area. Exactly one is open at a
time, so the single common-line flow sensor meters it unambiguously. One
irrigation sequence waters exactly one zone.
_Avoid_: output, output channel, station, valve on its own, channel.

**Selected Source / Selected Zone**:
The persisted choice of which source and which zone are in play. Device state
(`restore_value`), so it survives reboot and the manual button works offline. The
sequence, the manual button and the dashboard all act on the same selection.

### Flow and safety

**Open path**:
The pump's precondition: one open source upstream and one open zone downstream.
Checked both when a valve closes and when the pump is asked to start — a start
without a path is refused, not merely stopped later — so a running pump is never
deadheaded. The 3.8 bar pressure switch is the backstop, not the plan.

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

**Watering event**:
One pump-on span, bracketed on-device by a `handover` flag so a sequence's
deliberate mid-run pump toggles don't split it. Recorded only on completion, with
an RTC wall-clock start/end, litres, outcome, trigger and the zone it watered
(numeric; 0 means no zone was recorded). The controller is the
authoritative source; the server ingests, it does not detect.
_Avoid_: irrigation run, cycle, watering session.

**Watering event log**:
The durable on-device ring buffer (ESP32 NVS, N=192) of the most recent watering
events, published retained on `watering/log` for the server and per-event on
`watering/event` for observability. Survives weeks offline and reboots.

**Event seq**:
The durable, monotonic sequence number stamped on each watering event. The
server's dedup key; a gap in it tells the server exactly how many events rolled
off the ring unseen.

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
