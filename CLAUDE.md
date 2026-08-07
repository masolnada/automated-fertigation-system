# CLAUDE.md

## Design

Any UI work on the dashboard (`web/apps/dashboard/`) MUST follow the design system in
[web/packages/ui/DESIGN.md](web/packages/ui/DESIGN.md). Translate its rules to this project's
React/TypeScript and Tailwind/CSS custom properties.

## Repo notes

- ESPHome config for a KinCony KC868-A8 fertigation controller lives in
  `controller/kc868-a8.yaml`; see README.md.
- No local ESPHome install: use `../my-esphome/.venv/bin/esphome`.
- Secrets: plaintext `controller/secrets.yaml` is gitignored; committed artifact
  is the age-encrypted `controller/secrets.enc.yaml` (recipient in
  `controller/.age-recipients`).
- Deployment is self-contained under `deploy/`: a Tailscale-only Caddy (static
  `file_server` + Cloudflare DNS-01 TLS + `/api` split), the Bun server, and a
  dedicated Mosquitto broker on the hort VM. See `deploy/README.md`.
