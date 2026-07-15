# CLAUDE.md

## Design

Any UI work on the dashboard (`dashboard/site/`) MUST follow the design system in
[dashboard/DESIGN.md](dashboard/DESIGN.md) — a minimalist e-ink style: strict
black-and-white monochrome, zero animation/transitions, sharp 90° corners, thick
black borders and dashed dividers. Translate its rules to this project's plain
HTML/CSS/JS (CSS custom properties, plain classes). No colors, rounded corners,
shadows, or gradients — ever.

## Repo notes

- ESPHome config for a KinCony KC868-A8 fertigation controller; see README.md.
- No local ESPHome install: use `../my-esphome/.venv/bin/esphome`.
- Secrets: plaintext `secrets.yaml` is gitignored; committed artifact is the
  age-encrypted `secrets.enc.yaml` (recipient in `.age-recipients`).
- The dashboard ships as a generic nginx build artifact; compose/vhost/env wiring
  lives in the separate homelab repo (snippets in `dashboard/README.md`).
