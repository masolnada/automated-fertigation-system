# Observability

Metrics and history for the system (`observability/`): Telegraf ingests MQTT
topics into InfluxDB, and a Grafana dashboard visualizes them. The source of
truth is this repo; the running homelab is a deploy target.

## Language

**Water used per period**:
A bar chart of water consumed in each interval, derived as the non-negative
difference of the monotonic Total Water counter and zero-filled. The primary
water view.
_Avoid_: flow total, cumulative water.

**Water interval**:
The bucket width for the usage bars, chosen from a fixed whitelist
(`15m`, `1h`, `6h`, `1d`, `7d`); anything else falls back to `1h`.

**Range total**:
Water used across the dashboard's current time range — `difference(nonNegative)`
summed over the range, so a mid-range Total Water reset does not corrupt it.

**Time since last watering**:
Elapsed time since the last positive Total Water difference, over a fixed 30-day
lookback independent of the time picker.

**Reset-tolerant aggregation**:
The rule that every water metric is built from non-negative differences of the
counter, so an irreversible Total Water reset reads as "no usage", never as a
large negative spike.
