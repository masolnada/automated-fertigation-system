# Implementation report

## Changed

- Added the Bun workspace under `web/` with dashboard, framework-free MQTT, and UI packages.
- Moved the e-ink design document to `web/packages/ui/DESIGN.md`.
- Added typed runtime config parsing, MQTT topic helpers, entity metadata, snapshot store, reset guards, React dashboard cards, runtime `config.json`, Bun build/dev scripts, and multi-stage nginx container image.
- Moved primitive visuals into `packages/ui/src/theme/variants.ts` as Tailwind utility maps. `apps/dashboard/src/styles.css` now contains only the masthead, grid placement, and responsive layout. The e-ink token file uses Tailwind theme/utilities imports without preflight; the global no-motion/no-radius/no-shadow reset remains as the e-ink enforcement boundary.
- Corrected the visual parity regressions found in review: badge padding is now `py-[0.35rem] px-[0.7rem]`, the global `:focus-visible` ring is restored in `eink.css`, and mobile phase padding is now `py-[0.4rem] px-[0.6rem]`. A full shorthand audit found no other axis transpositions. `max-h-60` remains 240px with Tailwind's 0.25rem spacing.
- Added `bunfig.toml` and Happy DOM preload so bare `bun test` runs the browser suite.
- Updated root/dashboard/Claude documentation and ignores for the new workspace.

## Coverage

- MQTT unit coverage includes config validation, topic parsing, the ordered reset guard chain, invalidation, all reset-result mappings (including unexpected payloads), and the non-retained reset publish.
- Broker-backed integration coverage starts an ephemeral aedes broker over WebSockets and verifies retained replay, formatted UI values, and offline invalidation.
- Happy DOM/Testing Library coverage verifies pending reset non-cancellation, successful reset closure/logging, the 10-second timeout message, live eligibility, valve exclusivity and both status messages, dialog ARIA/focus trapping/focus return, Escape menu ordering, and focused duration input protection.

## Verification

Passed from `web/`:

- `bun run typecheck`
- `bun test` — 20 passing tests
- `bun run build`
- Variant-map/baseline shorthand audit (no additional transpositions)
- `grep -c '\${' apps/dashboard/dist/index.html` — `0`
- Previous Docker smoke remains valid: image build succeeded, supplied environment rendered `/config.json`, and `GET /` returned `HTTP/1.1 200 OK`.

The fresh production bundle is **576 KB JavaScript** plus **13 KB CSS** (and linked source map). The Tailwind plugin emits unused utility declarations including names such as `transition`/`box-shadow`; preflight is disabled and the global `!important` e-ink reset ensures no rounded corners, shadows, gradients, or motion survives in effect.

## Outstanding manual verification

Manual side-by-side verification using `bun run dev` against the live broker remains the user's task.
