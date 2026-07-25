# Manual pump button

A physical push-button on the board starts and stops irrigation with no WiFi,
MQTT, or dashboard — the whole toggle runs on-device, so it works in the field
even when nothing else is reachable.

## Behaviour

The button toggles between two states via the `manual_pump_toggle` script
(`kc868-a8.yaml`):

| Press | Pump was | Action |
|---|---|---|
| Start | off | open **both** valves → wait 2s → pump on |
| Stop | on | pump off → wait 2s → close **both** valves |

Both valves are opened together on start; a **downstream mechanical valve
selects the source** (clean water vs. fertigation). This is why the firmware's
valve interlock was removed — the two GPIO valves are no longer mutually
exclusive. The automated `irrigation_sequence` still opens only one valve at a
time on its own.

The dry-run watchdog still applies: if the pump runs past its 15s priming grace
with no flow, `abort_irrigation` shuts everything down (see
[flow-sensor.md](flow-sensor.md)).

## Wiring

The button uses digital input **IN1** — one of the KC868-A8's 8 opto-isolated
"dry contact" inputs (EL357 optocouplers via the PCF8574 at `0x22`). A dry
contact needs no power or resistor: pressing simply closes the input to GND.

```
Button ─┬── IN1
        └── GND   (input-block common)
```

- Use a **normally-open momentary** push-button.
- Do **not** feed any voltage into IN1 — it only wants the contact to close.
- Any of IN1–IN8 works the same way; the firmware is set to IN1
  (`pcf8574_hub_in_1`, number 0). Change the pin number to move it.

## Firmware

`binary_sensor` **Pump Button** (`id: pump_button`), `inverted: true` so a
closed contact reads as pressed, with a 50 ms `delayed_on` debounce. `on_press`
runs `manual_pump_toggle`.

## Verify

After wiring, open the web UI (`http://kc868-a8.local`) and watch the **Pump
Button** binary sensor flip to ON when pressed — confirms the contact before you
rely on it.
