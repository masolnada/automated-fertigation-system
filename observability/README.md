# Fertigation observability artifacts

This directory is the **source of truth** for the Telegraf and Grafana files
that expose the KC868-A8 flow sensor to InfluxDB and Grafana. They live here
(in the fertigation repo) and are deployed into the homelab repo as build
artifacts — never edited in place over there.

## Contents

```
observability/
  telegraf/
    fertigation.conf   Telegraf input fragment (MQTT → InfluxDB)
  grafana/
    fertigation.json   Grafana dashboard (provisioned from file)
  justfile             Deploy recipes
  README.md            This file
```

## Deploying

From the repo root:

```bash
just --justfile observability/justfile deploy
```

Or from inside `observability/`:

```bash
just deploy
```

This copies both files into `../homelab/automation/`:

- `telegraf/telegraf.d/fertigation.conf`
- `grafana/dashboards-hort/fertigation.json`

## One-time homelab structural changes

The `just deploy` copy step does **not** perform the following structural
changes, which must be applied once by a homelab-side agent (or manually).
All paths are relative to `../homelab/automation/`.

### 1. Telegraf — enable `--config-directory`

In `docker-compose.yml`, on the `telegraf` service:

1. Add volume mount:
   ```yaml
   - ./telegraf/telegraf.d:/etc/telegraf/telegraf.d:ro
   ```

2. Override the default command so the directory is loaded alongside the main
   config:
   ```yaml
   command: >
     telegraf
     --config /etc/telegraf/telegraf.conf
     --config-directory /etc/telegraf/telegraf.d
   ```

The fragment (`fertigation.conf`) defines only an `[[inputs.mqtt_consumer]]`
block. It inherits the `[[outputs.influxdb_v2]]` already present in
`telegraf.conf` — no output duplication needed.

### 2. Grafana — mount the hort dashboards directory

In `docker-compose.yml`, on the `grafana` service, add a **separate** volume
mount (do **not** nest it under the existing `./grafana/dashboards` mount —
Grafana's existing provider scans that path recursively, and a nested dir would
cause the dashboard to be double-loaded and conflict):

```yaml
- ./grafana/dashboards-hort:/var/lib/grafana/dashboards-hort:ro
```

### 3. Grafana — add a second dashboard provider

In `grafana/provisioning/dashboards/provider.yaml`, append a second provider
entry (below the existing one):

```yaml
  - name: hort
    folder: Hort
    type: file
    disableDeletion: false
    updateIntervalSeconds: 30
    allowUiUpdates: true
    options:
      path: /var/lib/grafana/dashboards-hort
      foldersFromFilesStructure: false
```

After applying changes 1–3, `docker compose up -d telegraf grafana` will pick
them up.

## MQTT topics and InfluxDB schema

| MQTT topic | InfluxDB measurement | Tags |
|---|---|---|
| `kc868-a8/sensor/flow_rate/state` | `esphome_sensor` | `device=kc868-a8`, `entity=flow_rate` |
| `kc868-a8/sensor/total_water/state` | `esphome_sensor` | `device=kc868-a8`, `entity=total_water` |

Field name: `value` (float). Payload is a bare number (ESPHome default).

The Grafana dashboard uses datasource uid `influxdb-zigbee` and Flux queries
against `v.defaultBucket`.
