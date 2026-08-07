# Dashboards and Telegraf config are versioned here and deployed to the homelab

The Grafana dashboard JSON and Telegraf fragment live in this repo as the source
of truth; `just deploy` copies them into the separate homelab repo's
Telegraf/Grafana trees. Structural homelab wiring (the `--config-directory`
volume, the `dashboards-hort` mount, the extra provider entry) is a one-time,
document-only setup applied on the homelab side. Deployment is never run
automatically from a task — the operator runs `just deploy` and reloads Grafana.
