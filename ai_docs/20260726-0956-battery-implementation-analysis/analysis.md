# Battery implementation analysis

**Date:** 26-07-2026  
**Repository revision:** `267c263`  
**Battery supplied by the user:** Amazon ASIN [`B0CPJ9ZN65`](https://www.amazon.es/dp/B0CPJ9ZN65)  
**Scope:** battery, solar charging, SmartShunt monitoring, ESPHome logic, MQTT/dashboard exposure, power budget, safety controls, and known gaps.

## Executive assessment

The implementation is a good **monitoring foundation**, but it is not yet a battery protection system.

What is solid:

- The SmartShunt is read passively over encrypted BLE, with its MAC and AES key kept in secrets (`kc868-a8.yaml:22-34`).
- The external component is pinned to an immutable release tag, and the pin resolves to commit `0b408e3` (`kc868-a8.yaml:22-24`).
- Voltage and current are averaged over five seconds; other battery values are throttled to five seconds (`kc868-a8.yaml:431-464`).
- The ESP32 uses ESP-IDF because Arduino caused a confirmed BLE boot loop; this reduced the OTA image and restored reliable booting (`kc868-a8.yaml:12-20`, commit `45c07f8`).
- Pump and valves always restore OFF after power loss (`kc868-a8.yaml:73-107`).
- The current ESPHome configuration validates successfully with ESPHome `2025.11.4` and the real, non-placeholder SmartShunt credentials.

Main conclusion:

> The largest risk is the power path, not the telemetry. The battery may only support **8 A continuous discharge** according to the manufacturer's current product page, while the system can reach about **8.2 A during normal automatic operation near pump cutoff** and about **8.75 A in manual two-valve mode**. There is also no independent low-voltage or low-temperature charge protection configured in the repository.

## 1. Battery identification and specification reconciliation

The Amazon ASIN is sold as an EverExceed 12 V 8 Ah LiFePO4 battery with a built-in “10 A BMS”. External listings map it to the **EverExceed LDP 12-8**. The physical battery label should be checked before treating that mapping as final because the Amazon page does not expose a formal model number in the fetched listing.

### Best available product data

| Property | Current manufacturer/product page | EverExceed LDP V3.5/2023 datasheet | Repository now |
|---|---:|---:|---:|
| Model | LDP 12-8 | LDP 12-8 | Not named |
| Chemistry | LiFePO4 | LiFePO4 | LiFePO4 |
| Nominal voltage | 12.8 V | 12.8 V | 12 V |
| Capacity | 8 Ah | 8 Ah | 8 Ah |
| Nominal energy | 102.4 Wh | 102 Wh | 96 Wh |
| Recommended charge current | 4 A | 4 A | Not stated |
| Maximum charge current | 8 A | 8 A | 8 A |
| Maximum continuous discharge | **8 A** | **10 A** | 10 A |
| Peak discharge | 20 A for 2 s | Not listed in table | Not stated |
| Recommended charge voltage | 14.2–14.6 V | Not explicit in table | Approx. 14.2 V absorption |
| Recommended low-voltage disconnect | 11.2 V | Not listed | No disconnect implemented |
| BMS under-voltage protection | 9.2 V | Not listed | Relies on BMS |
| Charge temperature | 0–50 °C | 0–50 °C | 0–55 °C |
| Discharge temperature | -20–60 °C | -20–60 °C | Not stated |
| Cycle claim | 3,000+ at 100% DoD | 3,000 at 100% DoD | 3,000+ |
| Weight | Approx. 1.05 kg | 1.00 kg | Not stated |
| Terminal | F2 | F2 | Not stated |

Sources:

- [Amazon ASIN B0CPJ9ZN65](https://www.amazon.es/dp/B0CPJ9ZN65)
- [EverExceed current LDP 12-8 product page](https://www.everexceed.com/ip65-abs-case-12-v-8-ah-rechargeable-deep-cycle-lithium-battery_p529.html)
- [EverExceed LDP Series V3.5/2023 datasheet](https://grupopc.com/wp-content/uploads/2023/05/LDP-Series-Lithium-Iron-Phosphate-LiFePO4.pdf)

### Interpretation

The repository's `96 Wh` value is nominally low: `12.8 V × 8 Ah = 102.4 Wh`. More importantly, manufacturer material conflicts on continuous discharge: the older datasheet says 10 A, while the current product page says 8 A and 20 A for two seconds. Until the label or EverExceed confirms otherwise, design against **8 A continuous**.

The MPPT's configured 7 A charge limit is under the battery's listed 8 A maximum, but above its 4 A recommended current. It is therefore fast but aggressive: `7 A / 8 Ah = 0.875 C`. A 4 A limit is the conservative longevity/temperature choice; 7 A is only justified when rapid solar recovery is important and the exact pack specification is confirmed.

## 2. Power and charging architecture

The repository describes this path:

```text
100 W Vechline panel
        |
        v
Victron SmartSolar MPPT 100/20
        |
        +---- charge current, manually limited to 7 A
        |
        v
12.8 V / 8 Ah LiFePO4 battery
        |
        +---- SmartShunt in battery negative path
        |
        +---- KC868-A8 controller, pump and valves
```

The actual wiring schematic is not in the repository. Therefore the following cannot be verified from code:

- Whether every charger and load negative passes through the SmartShunt system-minus side.
- Whether there is a correctly sized battery-positive fuse close to the terminal.
- Cable gauge, connector rating, voltage drop, grounding and enclosure ventilation.
- Whether loads are connected directly to the battery or through the MPPT load output.
- Whether the battery has the exact BMS/current limits shown in current manufacturer data.

Correct shunt wiring is essential. Victron states that every load and charge-source negative must be on the system side; any bypass makes current, consumed Ah and SoC incorrect.

### Charge controller

The MPPT 100/20 is rated for 20 A charge current and a 20 A continuous load output. The repository correctly warns that the factory 20 A charge setting is too high for this pack and requires a manual 7 A cap (`README.md:17-20`).

Victron provides two relevant controls that are not represented in ESPHome:

1. **Load-output low-voltage disconnect.** This can physically shed the controller/pump load before the battery BMS trips. The repository identifies this gap but has not closed it (`README.md:29-33`).
2. **Low-temperature charge cutoff.** This only works when the MPPT receives battery temperature through a VE.Smart network from a Smart Battery Sense or a SmartShunt/BMV with its proper temperature sensor. It is not provided by the ESPHome DS18B20.

The current system has neither protection confirmed.

### Charge profile

The documented settings are:

- MPPT LiFePO4 preset.
- Maximum MPPT current 7 A.
- Approx. 14.2 V absorption and 13.5 V float.
- SmartShunt capacity 8 Ah, charged voltage 14.0 V, tail current 4%, detection time 3 minutes, Peukert 1.05, efficiency 99%, discharge floor 20% (`README.md:45-54`).

These SmartShunt values are internally coherent for an 8 Ah LFP pack. In particular:

- Tail current: `8 Ah × 4% = 0.32 A`.
- Peukert 1.05 is Victron's recommended fallback for lithium.
- Time-to-go ends at the configured 20% discharge floor, not at 0% SoC.

The statement that LiFePO4 can remain in float “indefinitely without harm” (`README.md:47`) is too absolute. The configured low float voltage is not an immediate overcharge hazard, but sustained high SoC can still affect calendar life. The documentation should say that no operator action is needed at full charge, without claiming zero ageing impact.

## 3. Monitoring implementation

### BLE ingestion

ESPHome enables a global BLE tracker and registers one Victron device by MAC and AES bind key (`kc868-a8.yaml:26-34`). The selected external component:

- Filters packets by MAC and Victron manufacturer record.
- Checks packet size and record type.
- Checks the first bind-key byte before decrypting.
- Decrypts AES-CTR advertisements.
- Drops duplicate packet counters.
- Converts Victron unavailable sentinels to `NaN`.

The pin is good supply-chain practice, but it is now an old tag. There are upstream commits after `2024-12-27`; none appear essential to the five configured SmartShunt sensors, but the pin should be reviewed periodically rather than left indefinitely.

### Important BLE behavior

The component's own documentation says that **instant-readout advertisements stop while VictronConnect is actively connected to the SmartShunt**. Therefore the README claim that phone use works “in parallel” (`README.md:37`) needs qualification:

- Phone access remains possible.
- ESPHome may temporarily stop receiving new readings during the active app connection.
- Current code does not mark readings stale when advertisements stop.

ESPHome's default BLE scan interval/window is 320 ms/30 ms, about 9.4% listening duty per channel. This supports the repository's approximate 10% scan-duty statement (`README.md:43`). ESPHome also warns that the BLE stack consumes significant RAM. The project already encountered a real framework-specific BLE boot failure and resolved it by using ESP-IDF.

### Exposed sensors

The firmware publishes:

| ESPHome entity | Victron type | Unit | Filter |
|---|---|---:|---|
| Battery Voltage | `BATTERY_VOLTAGE` | V | 5 s average |
| Battery Current | `BATTERY_CURRENT` | A | 5 s average |
| Battery State of Charge | `STATE_OF_CHARGE` | % | 5 s throttle |
| Battery Consumed Ah | `CONSUMED_AH` | Ah | 5 s throttle |
| Battery Time Remaining | `TIME_TO_GO` | min | 5 s throttle |

Implementation: `kc868-a8.yaml:431-464`.

Victron current polarity is:

- Positive: net current entering the battery.
- Negative: net current leaving the battery.

“Time remaining” is a load-dependent estimate to the 20% floor. Victron explicitly warns that it is only a guideline under fluctuating loads. A pump switching between off, normal flow and pressure cutoff is exactly such a fluctuating load.

### Missing SmartShunt data

The component supports data not currently exposed:

- SmartShunt alarm state and alarm reason.
- Battery temperature if the SmartShunt AUX input has the proper Victron temperature sensor.
- Message callbacks that could maintain a reliable `last_seen` timestamp.

These omissions matter because the dashboard currently cannot distinguish a healthy reading from a retained, stale reading.

## 4. “Battery Charged” logic

The implementation defines a template binary sensor (`kc868-a8.yaml:334-350`):

```text
voltage >= 14.0 V
AND abs(current) <= 0.32 A
continuously for 180 seconds
```

On transition to ON it publishes:

```text
kc868-a8/battery/charged = ON
```

### What it does well

- It matches the configured voltage, tail-current magnitude and three-minute duration.
- It rejects `NaN` voltage/current values.
- Five-second averaging reduces short noise spikes.
- `on_press` makes the custom MQTT publication transition-based instead of publishing continuously.

### Limitations

1. **It is a mirrored condition, not proof of SmartShunt synchronisation.** The BLE advertisement does not expose a “synchronised now” event. The firmware only observes similar inputs.
2. **No data-freshness gate exists.** If the last values are 14.0+ V and <=0.32 A and BLE then disappears, the stored values remain valid in ESPHome. The 180-second timer can finish on stale data and emit a false charge-complete event.
3. **VictronConnect can trigger that stale-data condition** because active phone connection may stop instant advertisements.
4. **`fabs(current)` is not exact Victron semantics.** Victron describes a low positive charge current. Absolute value also accepts a small discharge current. At 14 V this is unlikely but conceptually different.
5. **Solar charge can create early synchronisation.** Victron warns that passing clouds and fluctuating charge current can satisfy the condition too early; recommended mitigations are higher charged voltage, longer detection time or lower tail current.
6. **The badge means “condition currently true”, not “battery remains full”.** It turns OFF when voltage drops to float. That is consistent with the code, but the label `charged` can be misread as persistent state.
7. **The custom event is not consumed by the dashboard.** The dashboard listens to the normal binary-sensor state and ignores `kc868-a8/battery/charged` because its parser only accepts entity state topics (`dashboard/site/app.js:197-206`).

A better label is **Charge completion condition**, with a separate freshness sensor and timestamp.

## 5. Dashboard, MQTT and observability

The static dashboard subscribes to `kc868-a8/#` and displays all five battery values (`dashboard/site/index.html:52-66`, `dashboard/site/app.js:23-28`). It also shows the charged badge and logs the ON transition (`dashboard/site/app.js:197-205`).

Strengths:

- Simple direct MQTT path.
- Suitable numeric precision: 0.01 V, 0.01 A, 0.1% SoC, 0.1 Ah and whole minutes.
- Retained ESPHome state allows immediate repopulation after reconnect.

Gaps:

- No last-update time or stale-data state.
- No low-voltage, low-SoC, over-current or temperature warning.
- No indication that SoC/consumed Ah/time-to-go are unsynchronised.
- Time remaining is shown only as raw minutes.
- No battery trend charts.
- MQTT credentials are browser-visible by design; the dashboard must remain LAN/Tailscale trusted (`dashboard/README.md:1-16`).

The observability pipeline currently ingests only flow rate and total water (`observability/telegraf/fertigation.conf:1-24`). Battery telemetry, charge events and alarms are not stored in InfluxDB or shown in Grafana.

## 6. Recalculated power budget

Assumptions come from `README.md:22`: board 0.13 A, relay coil 0.04 A, valve 0.5 A, pump 3.5–4 A normally and 7.5 A near pressure cutoff.

### Automatic irrigation: pump + one valve + two relay coils

| Pump state | Estimated total current | 30-minute sequence | Energy at 12.8 V |
|---|---:|---:|---:|
| 3.5 A pump | 4.21 A | 2.10 Ah | 26.9 Wh |
| 4.0 A pump | 4.71 A | 2.35 Ah | 30.1 Wh |
| 7.5 A near cutoff | 8.21 A | 4.11 Ah | 52.5 Wh |

The repository's `2.1 Ah / 27 Wh` default-sequence estimate is valid at the low end of normal pump current (`README.md:24`). At 4 A pump current it is closer to 2.35 Ah / 30 Wh.

### Manual mode: pump + both valves + three relay coils

Manual mode deliberately opens both valves before starting the pump (`kc868-a8.yaml:292-310`).

| Pump state | Estimated total current |
|---|---:|
| 3.5 A pump | 4.75 A |
| 4.0 A pump | 5.25 A |
| 7.5 A near cutoff | **8.75 A** |

This mode is more demanding than the README's one-valve budget. It exceeds the current manufacturer's 8 A continuous rating near cutoff and leaves only 1.25 A below the older 10 A figure.

### Usable capacity to the configured 20% floor

- Nominal: 8 Ah / 102.4 Wh.
- Usable to 20% floor: 6.4 Ah / 81.9 Wh.
- Default sequences to floor: about 2.7–3.0, depending on pump current.
- Continuous automatic pumping to floor: about 1.36–1.52 hours at normal pump current.
- Full-to-empty continuous runtime: about 1.70–1.90 hours.

The README's “about three sequences” is reasonable. Its 1.7-hour continuous figure is approximately a **full-to-empty** number, not runtime to the configured 20% floor (`README.md:25`).

### Standby

Without the BLE estimate:

- `0.13 A × 24 h = 3.12 Ah/day`.
- Full-to-empty: about 2.56 days.
- To 20% floor: about 2.05 days.

Including the documented 0.2–0.4 W BLE cost:

- Total standby: about 3.50–3.87 Ah/day.
- Full-to-empty: about 2.07–2.29 days.
- To 20% floor: about **1.65–1.83 days**.

The README's 2.2-day value is plausible only as a full-to-empty estimate. Operational planning should use the shorter 20%-floor value (`README.md:26`, `README.md:43`).

### Solar recovery

- At 7 A, replacing 2.1–2.35 Ah is 18–20 minutes ideally, longer with tapering and losses. The documented 20–40 minutes is plausible in strong sun.
- At the manufacturer's recommended 4 A, ideal replacement is 32–35 minutes; practical recovery is more likely 35–60 minutes.

## 7. Failure behavior

| Failure | Current behavior | Consequence |
|---|---|---|
| Low battery | Monitoring only | Pump can continue until BMS or voltage collapse disconnects power |
| BMS trip | Whole system may lose power | Abrupt pump/valve shutdown and controller reboot |
| Controller power loss | Relays restore OFF | Safe restart state |
| BLE advertisements stop | Last battery values remain | Dashboard and charge logic can use stale data |
| VictronConnect phone session | BLE instant readout may pause | Same stale-data risk |
| SmartShunt unsynchronised | SoC/Ah/time may be unavailable or unreliable | No explicit dashboard warning |
| Sub-zero battery at sunrise | No confirmed charger-side cutoff | Potential LiFePO4 charging damage |
| Pump pressure cycling | Current can approach/exceed pack continuous limit | BMS trip, voltage sag, contact/cable heating |
| Shunt bypass wiring | Missing current from SoC integration | SoC reads too high and runtime estimate is unsafe |
| MQTT/dashboard outage | Device automation continues | Battery protection still absent because none is local or hardware-based |

The debug uptime/reset-reason instrumentation can distinguish brownout from firmware reset (`kc868-a8.yaml:540-548`). It is useful evidence if relay/pump starts cause voltage collapse.

## 8. Risk register and recommended order

### Critical

1. **Resolve battery current rating.** Inspect the physical model/label and request EverExceed confirmation for continuous and peak current. Until confirmed, enforce 8 A continuous.
2. **Prevent pump operation near pressure cutoff.** Keep the hydraulic path open enough to avoid pressure cycling. Validate automatic and manual two-valve modes with SmartShunt peak/current logging.
3. **Add independent low-voltage load disconnect.** Route loads through the MPPT 20 A load output or use its virtual load output with a suitably rated BatteryProtect/contactor. Select thresholds after loaded-voltage testing; the current manufacturer recommendation is 11.2 V disconnect.
4. **Add independent low-temperature charge cutoff.** Use Smart Battery Sense or the proper SmartShunt temperature sensor in a VE.Smart network with the MPPT. Do not rely on the ESPHome DS18B20 or an unverified BMS cutoff.
5. **Audit fuse, cable and shunt wiring.** Document it in a schematic.

### High

6. Add a SmartShunt `last_seen` timestamp and declare battery data unavailable after a short timeout, for example 15–30 seconds.
7. Gate charge-complete detection on fresh data; reset the three-minute timer whenever advertisements stop.
8. Expose SmartShunt alarm/alarm-reason and battery temperature.
9. Add local irrigation start protection using fresh battery data, with conservative voltage/SoC hysteresis. SoC alone must not be trusted while unsynchronised.
10. Add battery MQTT ingestion, Grafana trends and alerts for voltage, current, SoC, stale data, high discharge, low voltage and time since full charge.

### Medium

11. Add MPPT BLE telemetry: charge state, PV power, output current, load current and charger errors. The existing external component supports SmartSolar devices.
12. Review 7 A versus 4 A charging. Use 4 A for conservative operation; retain 7 A only with confirmed pack limits and measured temperatures.
13. Rename `Battery Charged` to reflect that it is a derived condition, not a confirmed SmartShunt sync event.
14. Show battery data age and format time-to-go as hours/minutes on the dashboard.
15. Periodically review the pinned Victron BLE component against upstream changes and current ESPHome compatibility.

### Documentation corrections

16. Update nominal energy from 96 Wh to 102.4 Wh.
17. Update charge temperature from 0–55 °C to the product's published 0–50 °C unless the physical label says otherwise.
18. Document the 8 A versus 10 A continuous-discharge conflict.
19. Separate runtime figures into full-to-empty and runtime to the 20% floor.
20. Qualify the claims about phone-parallel BLE operation and indefinite float charging.

## 9. Verification checklist

Before unattended use:

- Photograph and record battery label, serial/model and printed electrical limits.
- Confirm MPPT LiFePO4 preset and current limit in VictronConnect.
- Confirm SmartShunt settings listed in `README.md:49-54`.
- Confirm positive fuse rating and placement.
- Confirm all negatives pass through the SmartShunt.
- Log current during:
  - controller idle;
  - each valve alone;
  - automatic irrigation at open flow;
  - manual mode with both valves;
  - pump near pressure cutoff;
  - pump restart/inrush.
- Confirm charge current never exceeds the selected limit.
- Confirm low-voltage disconnect under a real pump load, not only at idle.
- Confirm cold-charge cutoff using a safe controlled test or Victron diagnostic state.
- Disconnect/disable SmartShunt BLE and verify the future stale-data state appears.
- Connect VictronConnect during absorption and verify charge-complete logic cannot complete from frozen data.
- Perform one full charge and confirm SmartShunt synchronises to 100%.
- Compare dashboard values against VictronConnect and a multimeter/clamp meter.

## 10. Evidence reviewed

Repository:

- `README.md:5-56` — hardware, power budget, limits, SmartShunt and charging settings.
- `kc868-a8.yaml:12-34` — ESP-IDF, external component and BLE credentials.
- `kc868-a8.yaml:73-107` — safe relay restore behavior and two-valve design.
- `kc868-a8.yaml:292-310` — manual two-valve pump mode.
- `kc868-a8.yaml:334-350` — charged-condition logic and MQTT event.
- `kc868-a8.yaml:431-464` — SmartShunt sensors and filters.
- `kc868-a8.yaml:540-566` — reboot diagnostics and MQTT watchdog behavior.
- `dashboard/site/index.html:52-66` — battery presentation.
- `dashboard/site/app.js:23-28` and `dashboard/site/app.js:197-205` — formatting and charged badge.
- `observability/telegraf/fertigation.conf:1-24` — flow-only telemetry ingestion.
- Battery-related commits: `e47745c`, `9387143`, `45c07f8`, `b462c68`, `63ae571`, `7926dab`.

External:

- [EverExceed current LDP 12-8 product page](https://www.everexceed.com/ip65-abs-case-12-v-8-ah-rechargeable-deep-cycle-lithium-battery_p529.html)
- [EverExceed LDP V3.5/2023 datasheet](https://grupopc.com/wp-content/uploads/2023/05/LDP-Series-Lithium-Iron-Phosphate-LiFePO4.pdf)
- [Victron SmartShunt manual — settings](https://www.victronenergy.com/media/pg/SmartShunt/en/all-features-and-settings.html)
- [Victron SmartShunt manual — operation](https://www.victronenergy.com/media/pg/SmartShunt/en/operation.html)
- [Victron SmartShunt manual — troubleshooting](https://www.victronenergy.com/media/pg/SmartShunt/en/troubleshooting.html)
- [Victron SmartSolar MPPT 75/10 to 100/20 manual](https://www.victronenergy.com/media/pg/Manual_SmartSolar_MPPT_75-10_up_to_100-20/en/configuration-and-settings.html)
- [Victron SmartSolar MPPT datasheet](https://www.victronenergy.com/upload/documents/Datasheet-SmartSolar-charge-controller-MPPT-75-10,-75-15,-100-15,-100-20_48V-EN.pdf)
- [ESPHome BLE tracker documentation](https://esphome.io/components/esp32_ble_tracker/)
- [Pinned `esphome-victron_ble` source](https://github.com/Fabian-Schmidt/esphome-victron_ble/tree/0b408e303d8797f30f1adc44c906cb20ed708a28)

## Final conclusion

The battery monitoring path is technically sound for visibility, and the choice of SmartShunt plus passive BLE is appropriate. The implementation should not yet be treated as autonomous battery management. The immediate work is to protect the battery electrically and thermally, verify the true continuous-current rating, and prevent stale telemetry from being interpreted as live state. After those controls exist, battery-aware irrigation interlocks and observability can safely build on the current firmware.
