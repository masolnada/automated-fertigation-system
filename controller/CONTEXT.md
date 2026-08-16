# Fertigation Controller

The KC868-A8 firmware (`controller/kc868-a8.yaml`): it waters the crop while injecting a
fertigation substance, meters the water, and publishes device state over MQTT.
This is the safety-critical core of the system — it drives the pump and valves.

## Language

### Irrigation

**Irrigation sequence**:
The one automation that waters. It runs three phases and always shuts itself
down; there is no state in which it ends with the pump running. It waters one
channel with one recipe, both handed to it — so it is the same automation whether
a person, a button or a schedule entry asked for it.
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

**Channel run**:
One irrigation sequence, which waters exactly one output channel from start to
finish. Watering several means starting the sequence again on each. The channel
and the Cycle recipe are both *inputs* to the run — carried on the start, not read
from what happens to be open or from what was last adjusted by hand — so a start
naming neither is refused rather than completed from device state. Its first act
is to close the other output channels and open its own, pausing the pump across
the change as any handover does.
_Avoid_: zone run — the firmware does not know what a zone is.

**Fertigation substance**:
Humic acid (e.g. potassium humate) injected into the supply during the
Fertigation phase, drawn from the Fertigation source.
_Avoid_: nutrients, fertilizer.

**Microbiology source**:
A third source holding micro-organisms, kept separate from the humate so the two
can be dosed independently. Relay-backed and manually selectable; the irrigation
sequence does not yet open it.

**Cycle recipe**:
The four values that decide how one run waters — Cycle Mode, Cycle total, Pre-wet
Percent and the flush duration — taken together. An input to the run, carried on
the start beside the channel and held by each Schedule entry, so no run inherits
what the last one happened to use and nothing a run does leaks into the next.
_Avoid_: settings, config, programme.

**Default recipe**:
The one Cycle recipe the device itself holds, in the `Default *` entities. Not
what a commanded or scheduled run waters with — those carry their own — but what
the offline manual button uses, since a button has no payload to carry one, and
the values a new irrigation is proposed with. Read in exactly one place, which is
why the entities are named for what they are: a name claiming to be "the" cycle
setting would promise to govern runs it has no say over.
_Avoid_: current settings, cycle settings — neither current nor the settings of
any run in flight.

**Cycle Mode**:
Whether the cycle total is expressed in Time or Volume.

**Cycle total**:
The size of one cycle — minutes in Time, litres in Volume.

**Pre-wet Percent**:
The share of the cycle total given to Pre-wet (5% steps); Fertigation gets the
remainder. There is no fertigation-percent entity, so the split cannot be made
inconsistent.

**abort_irrigation**:
The single shared stop path: stop the sequence, pump off, wait 2 s, both valves
off. Used by the stop button, the MQTT stop topic, and every stop-dead watchdog
case.

### Scheduling

**Schedule entry**:
One durable instruction to water: a time of day, how often it repeats, the output
channel it waters, and the whole Cycle recipe it waters with. The device holds
them and fires them from its own RTC, so watering continues through the weeks the
controller has no network — a scheduler that only ran while the server could
reach it would contradict the deployment (ADR-0018).

Self-contained by the same argument that made the channel an input to the run
(ADR-0017): an entry that read the Default recipe would water differently
depending on what was last adjusted by hand, and two entries could not differ at
all. It names a channel and not a place, because a place is a Zone and Zones
exist only on the server.
_Avoid_: program, timer, cron, schedule on its own.

**Frequency**:
Which dates a Schedule entry fires on, in one of two forms and never both: a set
of weekdays, or every N days counted from a fixed start date. Both are pure
functions of the calendar date, so the device answers "does this fire today?"
from the RTC alone — nothing to keep, nothing to drift. Counting instead from the
last run would push a cadence later every time a run was missed, and the weeks
this controller spends dark are exactly when that happens.
_Avoid_: interval, repeat, recurrence.

**Time slot**:
A time of day on a date some entry fires on. It belongs to the *machine*, not to
a channel: there is one pump and the sequence is `mode: single`, so two entries
due at the same moment collide however different their zones. Taken slots are
refused when an entry is created; the Skipped run remains for the collisions no
guard can predict.

**Skipped run**:
A Schedule entry whose turn came while the controller was already watering. The
sequence waters one channel at a time and refuses to start a second, so the entry
is dropped rather than queued — but it is written to the watering event log with
no litres, because a zone that silently went unwatered is a question the history
has to be able to answer.
_Avoid_: missed run, failed run — nothing failed.

**Trigger**:
What started a watering: the physical button, a person on the dashboard, or a
Schedule entry coming due. Recorded on the event because "is the schedule
working?" is a question only the history can answer, and it cannot if a run the
controller started on its own is indistinguishable from one a person asked for.
It records *what kind of thing* started the run, never *which* entry — entries are
server-side and get deleted, and the history must not depend on them existing.

### Channels

**Source**:
An upstream 12 V electrovalve selecting what the pump draws — Clean Water,
Fertigation, or Microbiology. Exactly one is open at a time. Which source is
which is fixed in firmware, because the Flush and Recovery flush depend on
knowing which one is clean water, offline, with no server.
_Avoid_: input, input channel — the board's `a8-input*` dry-contact terminals
already own that word.

**Output channel**:
A downstream 12 V electrovalve, numbered and nothing more. Exactly one is open at
a time, so the single common-line flow sensor meters it unambiguously. The
firmware never interprets one: *which place* a channel waters is a Zone, and
Zones exist only on the server (web ADR-0014). Hardware-fixed at four by the
relay budget (ADR-0015).
_Avoid_: zone, station, valve on its own.

**Selected Source / Selected Output**:
The persisted record of which source and which output channel are in play. Device
state (`restore_value`), so it survives reboot and the manual button works
offline. Written by any valve opening, whoever opened it, so it tracks what the
pump is drawing from and sending to. It is what the manual button waters, but not
what a channel run waters — a run carries its own channel and leaves this as its
record, which is why a run also changes where the button will next send water.

### Flow and safety

**Open path**:
The pump's precondition: one open source upstream and one open output channel
downstream.
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
an RTC wall-clock start/end, litres, outcome, trigger and the output channel it
watered (numeric; 0 means none was recorded). The controller is the
authoritative source; the server ingests, it does not detect.

A Skipped run is the one entry that records no pump-on span at all: it is in the
log because the log is where the history of a channel lives, not because water
moved.
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
