# CLAUDE.md

## Design

Any UI work on the dashboard (`dashboard/site/`) MUST follow the design system in
[dashboard/DESIGN.md](dashboard/DESIGN.md) — a hand-drawn/sketchbook style (wobbly
borders, hard offset shadows, handwritten fonts, paper textures) with defined
tokens, component stylings, and interaction rules. The design file is
written for a Tailwind/React context; translate its tokens and rules to this
project's plain HTML/CSS/JS (CSS custom properties, plain classes). Do not invent
colors, radii, shadows, or typography outside that spec.

## Repo notes

- ESPHome config for a KinCony KC868-A8 fertigation controller; see README.md.
- No local ESPHome install: use `../my-esphome/.venv/bin/esphome`.
- Secrets: plaintext `secrets.yaml` is gitignored; committed artifact is the
  age-encrypted `secrets.enc.yaml` (recipient in `.age-recipients`).
- The dashboard ships as a generic nginx build artifact; compose/vhost/env wiring
  lives in the separate homelab repo (snippets in `dashboard/README.md`).
