# Soil Node

The battery-powered LoRa soil logger (`soil-node/`): it measures soil water
tension and reports home by radio. It only logs — it makes no irrigation
decisions ([ADR-0001](./adr/0001-logging-only-scope.md)). The design decisions
live in [`adr/`](./adr/); this file is the glossary.

## Language

**Node**:
The buried ESP32-C3 sensor unit — a pure LoRa transmitter with no WiFi and no
receive path.
_Avoid_: sensor, device (ambiguous with the controller).

**Gateway**:
The KC868-A8 controller in its second role: it receives the node's LoRa packets
and republishes them to MQTT.
_Avoid_: base station, receiver.

**Soil water tension**:
Suction the soil exerts on water, in kPa — how hard a root must pull to drink.
The primary measurement (higher = drier).
_Avoid_: soil moisture, humidity.

**Watermark**:
A Watermark 200SS granular-matrix sensor whose resistance varies with tension;
read via an H-bridge divider and an ADS1115.

**Raw resistance**:
The sensor resistance transmitted alongside kPa, so calibration can be revisited
downstream without reflashing a node that has no OTA
([ADR-0013](./adr/0013-node-side-conversion.md)).

**Fault sentinel**:
A reserved out-of-range value (255 open, 240 short) that makes a broken or
disconnected sensor look faulty rather than dry.

**Packet transport**:
The secured LoRa link — XXTEA encryption plus a rolling code against replay
([ADR-0016](./adr/0016-packet-transport-security.md)).
