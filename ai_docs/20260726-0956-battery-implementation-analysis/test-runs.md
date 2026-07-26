# Battery discharge test runs

## Test 1 — successful operational discharge

**Date:** 26-07-2026  
**Location/time zone:** Barcelona, CEST  
**Purpose:** Verify sustained fertigation operation after the earlier BatteryLife low-voltage shutdown.

### Recorded values

| Item | Value |
|---|---:|
| Start time | 11:42 |
| End time | 13:32 |
| Duration | 1 h 50 min / 110 min |
| Initial battery voltage | 13.73 V |
| Initial MPPT state | Float |
| Solar panel | Disconnected for the complete test |
| Final SmartShunt state of charge | 23.1% |
| Final SmartShunt consumed capacity | -5.6 Ah |
| Operational result | Successful; KinCony remained operational for the complete test |

### Derived values

- Net capacity removed: `5.6 Ah`, equal to 70% of the nominal 8 Ah capacity.
- Average battery/load current: approximately `3.05 A` over 1.83 hours. With the panel disconnected, this is a battery-only measurement rather than a net value reduced by solar charging.
- SmartShunt-estimated remaining capacity at 23.1%: approximately `1.85 Ah`.
- Consumed plus estimated remaining capacity: approximately `7.45 Ah`; this is reasonably close to the configured 8 Ah capacity given initial synchronisation, charge efficiency, Peukert compensation and measurement conditions.

### Interpretation

The controller operated successfully from the battery alone for 110 minutes, compared with the earlier shutdown after approximately eight minutes. This strongly suggests the earlier event was caused by low actual battery charge rather than a fixed KinCony firmware timeout or an inherently undersized battery. An intermittent wiring issue cannot be completely excluded without loaded-voltage measurements.

The earlier failed run recorded a minimum MPPT battery voltage of `9.65 V`, causing the BatteryLife load output to disconnect. No equivalent shutdown occurred during this test.

### Battery-only conclusion

The solar panel was disconnected for the complete test. The SmartShunt's `-5.6 Ah` therefore represents battery-only consumption, assuming no other charging source was connected. At the observed average load, reaching the configured 20% discharge floor would be expected at roughly 1 hour 55 minutes from the start. The recorded 1 hour 50 minute run ending at 23.1% is consistent with that estimate.

### Values not recorded

- Final battery voltage.
- Final MPPT charge state.
- Minimum loaded voltage.
- Maximum discharge current.
- Exact pump/valve operating pattern.
- Whether the SmartShunt was synchronised to 100% at the start.

Future tests should record these values to distinguish battery capacity, solar contribution, wiring voltage drop and peak pump current.
