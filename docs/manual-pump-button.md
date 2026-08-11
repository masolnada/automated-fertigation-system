# Manual pump button

A physical push-button on the board starts and stops irrigation with no WiFi,
MQTT, or dashboard — the whole toggle runs on-device, so it works in the field
even when nothing else is reachable.

## Behaviour

The button toggles between two states via the `manual_pump_toggle` script
(`controller/kc868-a8.yaml`):

| Press | Pump was | Action |
|---|---|---|
| Start | off | open the selected source + selected zone → wait 2s → pump on |
| Stop | on | pump off → wait 2s → close every source and zone |

The button opens **the persisted selection**, not everything: one source and one
zone. Opening all of them would let the three tanks back-feed each other, and
seven held valves at ~0.5 A each would put the normal running total near the
10 A BMS limit. Ball valves still refine the path downstream of the open zone.

Because `Selected Zone` and the selected source are stored with
`restore_value`, the button works after a power cycle with no wifi — it waters
wherever the system was last pointed. If nothing is selected (first boot) the
button opens nothing and the pump is refused: it needs an open path on both
sides ([ADR-0016](../controller/docs/adr/0016-pump-requires-open-path-both-sides.md)).

The dry-run watchdog still applies: if the pump runs past its 15s priming grace
with no flow, `abort_irrigation` shuts everything down (see
[flow-sensor.md](flow-sensor.md)).

## Wiring

The button uses digital input **D8** — one of the KC868-A8's 8 opto-isolated
"dry contact" inputs (EL357 optocouplers via the PCF8574 at `0x22`). A dry
contact needs no power or resistor: pressing simply closes the input to GND.

```
Button ─┬── D8
        └── GND   (input-block common)
```

- Use a **normally-open momentary** push-button.
- Do **not** feed any voltage into D8 — it only wants the contact to close.
- Any of D1–D8 works the same way; the firmware is set to D8
  (`pcf8574_hub_in_1`, number 7). Change the pin number to move it.

## Firmware

`binary_sensor` **Pump Button** (`id: pump_button`), `inverted: true` so a
closed contact reads as pressed, with a 50 ms `delayed_on` debounce. `on_press`
runs `manual_pump_toggle`.

## Verify

After wiring, open the web UI (`http://kc868-a8.local`) and watch the **Pump
Button** binary sensor flip to ON when pressed — confirms the contact before you
rely on it.
