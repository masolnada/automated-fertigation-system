# The pump requires an open path on both sides, not just upstream

`stop_pump_without_path` previously stopped the pump only when the last *source*
closed. With zone valves downstream, that is no longer sufficient: an open source
and every zone shut leaves the pump deadheading against a closed line. The
invariant is therefore symmetric — the pump runs only with at least one open
source **and** at least one open zone, and closing the last valve on either side
stops it.

This matters because the margin is thin, not theoretical: the pump draws up to
7.5 A near its 3.8 bar cutoff against a 10 A BMS, with no headroom for restart
inrush (see README power budget). Deadheading drives it straight there. The
pressure switch stays what ADR-0001 always called it — the backstop, not the
plan.

The check runs in two places, and one is not enough. On every valve close, because
a valve going shut can break a path the pump is currently using. And on pump-on,
because a start with nothing open would otherwise deadhead for the dry-run
watchdog's entire priming-plus-confirm window (~18 s) before anything reacted;
refusing the start also keeps junk zero-litre events out of the watering log.

## Consequences

- Selecting a different zone while the pump runs stops the pump, exactly as
  switching source already does. The sequence never does this: one run waters one
  zone (ADR-0015).
- Both the sequence and the manual button must open a zone before starting the
  pump, which is why the selected zone is persisted device state rather than a
  dashboard-side choice.
