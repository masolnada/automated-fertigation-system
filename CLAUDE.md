# CLAUDE.md

## Design

Any UI work on the dashboard (`web/apps/dashboard/`) MUST follow the design system in
[web/packages/ui/DESIGN.md](web/packages/ui/DESIGN.md). Translate its rules to this project's
React/TypeScript and Tailwind/CSS custom properties.

## Repo notes

- ESPHome config for a KinCony KC868-A8 fertigation controller; see README.md.
- No local ESPHome install: use `../my-esphome/.venv/bin/esphome`.
- Secrets: plaintext `secrets.yaml` is gitignored; committed artifact is the
  age-encrypted `secrets.enc.yaml` (recipient in `.age-recipients`).
- The dashboard ships as a generic nginx build artifact; compose/vhost/env wiring
  lives in the separate homelab repo (snippets in `web/README.md`).
