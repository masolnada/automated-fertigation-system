# Plan: Port the dashboard to a Bun/React/TS/Tailwind monorepo under `web/`

## Goal

Replace the static page in `dashboard/site/` with a **strict feature-parity**
React + TypeScript app, built and served by Bun tooling, organised as a Bun
workspace monorepo under `web/`, styled with Tailwind v4 behind a swappable
theme boundary. Production still serves static files from **nginx** with
runtime-injected config.

## Non-goals

- **No Express/Bun backend.** That is the next hand-off. The browser talks MQTT
  over WebSockets directly, exactly as today.
- **No new features**: no soil-node view, no routing, no history/charts.
- **No fix for the cleartext MQTT credential exposure** (`dashboard/README.md:63`).
  It moves across as-is and stays documented.
- **No deletion of `dashboard/`.** It is marked deprecated and removed in a
  follow-up commit after the homelab cutover.
- **No visual redesign.** Rendered output must match today's page.

## Decisions already resolved (do not relitigate)

| Topic | Decision |
|---|---|
| Workspace root | `web/`, **not** the repo root. The firmware root stays free of `package.json`/`node_modules`/lockfile. |
| Scope | Strict feature parity with `dashboard/site/`. |
| Packages | `apps/dashboard`, `packages/mqtt` (framework-free), `packages/ui` (primitives + e-ink theme). |
| `DESIGN.md` | Moves to `web/packages/ui/DESIGN.md`. |
| Theme swap | Behaviour lives in `packages/ui`; visuals come from a variant map + Tailwind `@theme` tokens. E-ink is the single shipped theme. |
| State model | One typed snapshot in `packages/mqtt`; React subscribes via `useSyncExternalStore`; guards are pure functions of the snapshot. |
| Routing | None. `App` renders a layout shell + `<Dashboard />` so a router can be inserted later. |
| Prod runtime | nginx + `envsubst`, now rendering **`config.json`** (not `config.js`). |
| Config contract | Template holds `${MQTT_*}`; one TS type + validating parser owns consumption. `.env` is the dev-time source. |
| Old dashboard | Kept, marked deprecated. |
| Verification | Typecheck + `bun test` unit tests + integration tests against an in-process mock broker (`aedes`). |

## Verified toolchain facts (prototyped on Bun 1.3.10 — trust these)

These were tested on the host before writing this plan. They are not
assumptions.

- `Bun.build({ entrypoints: ["./src/index.html"] })` bundles an HTML entrypoint
  into hashed JS/CSS and rewrites the HTML to point at them.
- Tailwind v4 works **only via a build script** that imports
  `bun-plugin-tailwind` and passes it in `plugins: []`. The CLI form
  `bun build --plugin bun-plugin-tailwind` **fails** with
  `Browser build cannot import Node.js builtin: "module"`. Custom `@theme`
  tokens were verified present in the emitted CSS.
- `bun --port N src/index.html` starts a dev server with HMR. A `Bun.serve` with
  a `routes` map can serve `/config.json` from `process.env` alongside the HTML
  entrypoint import.
- Bun workspaces resolve cross-package imports correctly. Bun 1.3 uses isolated
  installs: expect `node_modules/.bun/` plus a symlink at
  `node_modules/@hort/<pkg>`, **not** a hoisted directory. This is normal.
- `bun test` + `@happy-dom/global-registrator` (via `--preload`) +
  `@testing-library/react` renders components. No Vitest, no jsdom needed.
- **Pin `typescript@5`.** `bun add -d typescript` currently installs
  `typescript@7` (the native port), which fails with
  `Cannot find type definition file for 'bun'`. Use `typescript@5` and
  `@types/bun`.
- A `<script src="/config.js">` inside the HTML entrypoint is a **hard build
  error** (`Could not resolve: "/config.js"`) because Bun tries to resolve
  root-relative paths. Absolute `https://` URLs pass through untouched. This is
  precisely why config is fetched as `/config.json` at runtime instead of being
  a script tag.
- Express 5 + `ws` + SSE all run fine on Bun (checked for the *next* hand-off;
  not used here).

## Reference: current implementation

Read these before starting. They are the source of truth for parity:

- `dashboard/site/app.js` (353 lines) — all behaviour.
- `dashboard/site/index.html` (149 lines) — DOM structure, ARIA, inline SVG icons.
- `dashboard/site/style.css` (465 lines) — the e-ink styling to translate.
- `dashboard/site/config.js.template` + `dashboard/entrypoint/40-render-config.sh`
  — the runtime config mechanism.
- `dashboard/Containerfile` — the nginx image.
- `dashboard/DESIGN.md` — binding design constraints.
- `kc868-a8.yaml:643-658` — MQTT command topics the firmware subscribes to.
- `kc868-a8.yaml:325-390` — the `reset_total_water` script and its exact result
  payloads.

## Target structure

```
web/
├── package.json                  # private, workspaces: ["apps/*", "packages/*"]
├── bun.lock
├── tsconfig.base.json
├── .env.example                  # MQTT_URL / MQTT_USERNAME / MQTT_PASSWORD / MQTT_PREFIX
├── README.md
├── packages/
│   ├── mqtt/                     # @hort/mqtt — NO React, NO DOM imports
│   │   ├── package.json
│   │   └── src/
│   │       ├── config.ts         # Config type + parseConfig()
│   │       ├── topics.ts         # parseStateTopic + command builders
│   │       ├── entities.ts       # entity registry: kind, decimals, label, unit
│   │       ├── store.ts          # snapshot store, subscribe/getSnapshot
│   │       ├── guards.ts         # resetIneligibleReason(snapshot), canReset()
│   │       ├── index.ts
│   │       └── *.test.ts
│   └── ui/                       # @hort/ui
│       ├── package.json
│       ├── DESIGN.md             # git mv from dashboard/DESIGN.md
│       └── src/
│           ├── theme/eink.css    # @theme tokens
│           ├── theme/variants.ts # class maps per primitive/state
│           ├── Card.tsx  Badge.tsx  Button.tsx  Metric.tsx
│           ├── Dialog.tsx  Menu.tsx  PhaseBar.tsx  ValveSelect.tsx
│           └── index.ts
└── apps/dashboard/
    ├── package.json
    ├── build.ts                  # Bun.build + bun-plugin-tailwind
    ├── dev.ts                    # Bun.serve: HMR + /config.json from process.env
    ├── config.json.template
    ├── entrypoint/40-render-config.sh
    ├── Containerfile             # multi-stage: oven/bun build -> nginx:alpine
    ├── src/
    │   ├── index.html  main.tsx  App.tsx  styles.css  useStore.ts
    │   └── cards/Irrigation.tsx Battery.tsx Relays.tsx Flow.tsx Environment.tsx Events.tsx
    └── tests/*.test.ts(x)
```

**Do not invent primitives beyond this list**: Card, Badge, Button, Metric,
Dialog, Menu, PhaseBar, ValveSelect. Card sub-components (header/body) are fine.

## Behaviour contract — must be preserved exactly

`dashboard/site/app.js` is authoritative. **Each item below must have a test.**

1. **Reset guard chain**, evaluated in this order, returning these exact reason
   strings (`app.js:31-44`):
   - `"Device or broker offline"` — broker not connected or device not online
   - `"Waiting for state"` — pump, flow or total not known
   - `"Pump running"` — pump on
   - `"Flow unknown"` — flow not finite
   - `"Flow active"` — flow >= 0.1
   - `"Total unknown"` — total not finite
   - `"Already zero"` — total <= 0
   - `"Waiting for device"` — a reset is pending
   - `""` — eligible
2. **Staleness invalidation.** All entity values become *unknown* on broker
   `connect`, on broker `close`, **and** on device `status != "online"`. Today
   these two paths disagree (`app.js:236-246` clears `deviceOnline` plus the
   known-flags; `app.js:301-306` clears only the known-flags). **Unify into one
   `invalidateAll()` transition** used by all three. This is an intentional
   consolidation, not a behaviour change: both paths must end in the strictest
   state.
3. **Reset round-trip.** Publish non-retained `<prefix>/flow/reset_total/request`
   with payload `ON`. Map result payloads from
   `<prefix>/flow/reset_total/result` to today's messages (`app.js:257-263`):
   - `success` -> log `"total water reset"` (normal)
   - `already_zero` -> log `"total water already zero"` (normal)
   - `rejected_pump_running` -> `"Device rejected reset: pump is running."` (danger)
   - `rejected_flow_active` -> `"Device rejected reset: flow is active."` (danger)
   - `rejected_flow_unknown` -> `"Device rejected reset: flow is unavailable."` (danger)
   - `error_persistence` -> `"Device could not persist zero. The reset may not survive reboot."` (danger)
   - anything else -> `` `Unexpected reset response: ${payload}.` `` (danger)
   These payloads are produced by `kc868-a8.yaml:325-390`. Results are logged
   **even when no dialog is open**, because native-web resets use the same topic.
4. **The reset dialog is non-cancellable while pending.** Only a resolved result
   or the 10s timeout may close or re-enable it (`app.js:141-143`,
   `app.js:217-224`). On timeout: show
   `"No response from device. Check its connection and current total before retrying."`
   as danger, re-enable cancel, and re-enable confirm only if still eligible.
5. **Reset eligibility stays live while the dialog is open**: re-evaluated on
   every state update, so a temporarily unsafe reset can become retryable
   (`app.js:131-137`).
6. **Valve exclusivity.** Three-state segmented control (Clean / Closed /
   Fertigation). Selecting a valve publishes `ON` to it; selecting Closed
   publishes `OFF` to **both** valves. A 5s pending timeout clears the pending
   mark (`app.js:88-93`). Pending status text:
   - pump on: `"Switching… both valves close for a moment, so the pump stops"`
   - pump off: `"Switching… both valves close for a moment"`
   The status line keeps its height when empty (`style.css:302-311`) so the grid
   does not shift.
7. **Decimal places per entity** (`app.js:47-51`): `battery_voltage` 2,
   `battery_current` 2, `battery_state_of_charge` 1, `battery_consumed_ah` 1,
   `battery_time_remaining` 0, `ds18b20-1` 1, `flow_rate` 1, `total_water` 1;
   default 1. Render `–` (en dash) when unknown or non-finite.
8. **Phase bar** (`app.js:63-70`): `flexGrow = max(minutes, 0.4)`; add a
   `narrow` state under 8 minutes which hides the label; tooltip is
   `` `${name} — ${minutes} min` ``. The fertigation segment is filled black
   (`style.css:262-266`).
9. **Number inputs are not overwritten while focused** (`app.js:322-324`), so a
   retained update cannot clobber typing.
10. **Visibility reconnect** (`app.js:249-254`): on becoming visible, if the
    page was hidden at least as long as the 30s keepalive, force
    `client.end(true, …)` then `reconnect()`.
11. **Event log**: newest first, capped at 50 entries (`app.js:11-19`), each with
    a `toLocaleTimeString()` timestamp. Danger severity for broker disconnect,
    broker error, device offline, dry-run, and reset failures. Empty state text
    from `style.css:377-382`. Browser-side events stay local; never published.
12. **Dialog accessibility** (`app.js:161-181`, `index.html:135-146`):
    `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`;
    focus trap cycling **enabled** buttons only; Escape closes the open menu
    first, otherwise the dialog; backdrop click closes; focus returns to the
    opener element. Menu trigger keeps `aria-haspopup`, `aria-expanded`,
    `aria-controls`; the reset menu item keeps `aria-describedby` pointing at the
    reason text and `aria-disabled`. Status regions keep `aria-live="polite"`.
13. **Topics.** State: `<prefix>/{sensor|binary_sensor|switch|number}/<id>/state`.
    Commands: `<prefix>/switch/<id>/command` with `ON`/`OFF`/`TOGGLE`,
    `<prefix>/number/<id>/command` with the numeric value,
    `<prefix>/irrigation/start`, `<prefix>/irrigation/stop`. Device status:
    `<prefix>/status`. Ignore `<prefix>/debug`. Log `<prefix>/flow/dry_run` as
    danger (`"dry-run shutdown reported by device"`). Subscribe to `<prefix>/#`
    on connect. Command topics must match `kc868-a8.yaml:643-658`.
14. **Confirmations.** Start irrigation, pump toggle, and reset total all confirm
    first. Stop irrigation and non-pump relay toggles do **not**
    (`app.js:328-352`). Pump dialog message:
    `"If it starts, make sure a valve is open."`
15. **Entities rendered** (from `index.html`): irrigation start/stop +
    `irrigation_running` badge + three duration numbers (`pre-wet_minutes`,
    `fertigation_minutes`, `flush_minutes`); battery voltage/current/SoC/
    consumed Ah/time remaining + `battery_charged` badge; relays (only `pump` is
    listed, with valves as the segmented control); flow rate + total water +
    the three-dot menu; environment `ds18b20-1`; events.
16. **MQTT connection options** (`app.js:232`): `keepalive: 30`,
    `reconnectPeriod: 3000`, username and password from config.

## Implementation steps

Do these in order. Run `bun test` and the typecheck as you go, not just at the end.

1. **Scaffold `web/`.**
   - Root `web/package.json`: `private: true`, `workspaces: ["apps/*", "packages/*"]`.
   - `web/tsconfig.base.json`: `strict: true`, `target: ES2022`,
     `lib: ["ES2022","DOM","DOM.Iterable"]`, `moduleResolution: "bundler"`,
     `jsx: "react-jsx"`, `noEmit: true`, `skipLibCheck: true`,
     `types: ["bun"]`. Also enable `noUncheckedIndexedAccess`.
   - Dev deps: `typescript@5`, `@types/bun`, `tailwindcss@4`,
     `bun-plugin-tailwind`, `@happy-dom/global-registrator`,
     `@testing-library/react`, `@testing-library/dom`, `aedes`, `ws`.
   - Deps: `react@19`, `react-dom@19`, `mqtt@5`.
   - **Pin exact versions** in `package.json` (no `^`) for `bun-plugin-tailwind`
     and `tailwindcss`, since the HTML/plugin API is young.
   - Add to the **root** `.gitignore`: `web/node_modules/`, `web/**/dist/`,
     `web/.env`. Keep the existing `/dashboard/site/config.js` entry.
   - `web/.env.example` documenting the four `MQTT_*` variables.

2. **`packages/mqtt` — config.** `Config = { brokerUrl, username, password, prefix }`.
   `parseConfig(input: unknown): Config` validates every field is a non-empty
   string and **rejects any value still containing `${`** (an unsubstituted
   template), throwing an error that names the offending field. This replaces the
   `:?` checks currently in `dashboard/entrypoint/40-render-config.sh:4-7`.

3. **`packages/mqtt` — topics + entities.** `parseStateTopic(prefix, topic)`
   returning a discriminated union (state message with `kind`+`objectId`, or a
   named special topic like `status` / `flow/dry_run` /
   `flow/reset_total/result` / `debug`, or unknown). Replaces the regex at
   `app.js:294`. Command builders for every topic in contract item 13. An entity
   registry mapping object id -> `{ kind, decimals, label, unit }`, replacing
   `app.js:47-51` and the hardcoded labels in `index.html`.

4. **`packages/mqtt` — store.** Framework-free. Snapshot shape:
   `{ brokerConnected, deviceOnline, entities: Record<string, { value: number|string, known: boolean }>, valves, resetPending, log }`.
   Expose `subscribe(cb)`, `getSnapshot()` (referentially stable between
   changes — required by `useSyncExternalStore`), and actions. Exactly one
   `invalidateAll()` used by connect, close, and device-offline (contract item 2).
   **No `mqtt` import in the reducer**: keep the reducer pure and inject the
   client, so this whole package can move server-side in the next hand-off.

5. **`packages/mqtt` — guards.** Pure `resetIneligibleReason(snapshot): string`
   and `canReset(snapshot): boolean` implementing contract item 1 verbatim.

6. **Unit tests** for steps 2-5 covering contract items 1, 2, 3 (mapping only),
   7, 13. Include a table-driven test walking every branch of the guard chain in
   order.

7. **`packages/ui`.**
   - `git mv dashboard/DESIGN.md web/packages/ui/DESIGN.md`.
   - `theme/eink.css`: `@import "tailwindcss";` plus an `@theme` block carrying
     the tokens from `style.css:5-18` (`--ink #000`, `--paper #fff`,
     `--gray #808080`, `--danger #B00020`, UI and numeric font stacks, the
     3px/2px border weights, the 2px dashed divider).
   - Preserve the global reset that kills animation and transitions
     (`style.css:20-24`) — this is a DESIGN.md hard rule, and Tailwind's
     defaults do not honour it.
   - `theme/variants.ts`: class maps per primitive and state. **Diff this against
     `dashboard/site/style.css` rule by rule — do not approximate.** Key idioms
     to keep: filled black = active (`.badge.on`, `.dot.on`, `.valve-select
     button.active`, `.phase-fertigation`); dashed border = not committed /
     offline (`.badge.offline`, `.valve-select button.pending`); danger red only
     where `style.css` uses it.
   - The eight primitives, behaviour-complete (focus trap, ARIA, keyboard) and
     visually driven **only** through the variant map, so a second theme is a new
     variant map + token file with no behavioural rewrite.
   - Tailwind must not reintroduce rounded corners, shadows, gradients or
     transitions anywhere.

8. **`apps/dashboard`.**
   - `src/index.html`: minimal shell with `<div id="root">` and the module
     script. **No `/config.js` script tag** (it is a build error).
   - `src/main.tsx`: `fetch("/config.json")` -> `parseConfig` -> create the MQTT
     client -> mount. On config failure, render a visible plain-text error rather
     than failing silently.
   - `src/useStore.ts`: `useSyncExternalStore` over the store.
   - `src/App.tsx`: masthead (logo SVG, `Hort`, subtitle, device + broker badges
     from `index.html:10-22`) and `<Dashboard />` holding the card grid. Keep the
     grid spans (`style.css:120-122`: irrigation and relays span 2 rows, log
     spans all columns) and the responsive rules (`style.css:449-464`, including
     hiding the subtitle and broker badge under 640px).
   - One card component per existing section, reusing the inline SVG icons from
     `index.html` verbatim.

9. **`build.ts` and `dev.ts`.**
   - `build.ts`: `Bun.build` with the HTML entrypoint, `plugins: [tailwind]`,
     `minify: true`, `sourcemap: "linked"`,
     `define: { "process.env.NODE_ENV": '"production"' }`, `outdir: "./dist"`.
     Exit non-zero and print `result.logs` on failure.
   - `dev.ts`: `Bun.serve` with `development: { hmr: true, console: true }`,
     importing the HTML entrypoint, plus a `/config.json` route built from
     `process.env` **through `parseConfig`** so dev and prod share one validator.
     Bun autoloads `web/.env`, so no dotenv dependency.
   - Add `scripts` to `package.json`: `dev`, `build`, `test`, `typecheck`.

10. **Container.** Multi-stage `Containerfile`: `oven/bun` stage runs
    `bun install --frozen-lockfile` and `bun run build.ts`; `nginx:alpine` stage
    copies `dist/` to `/usr/share/nginx/html/` and the entrypoint script to
    `/docker-entrypoint.d/40-render-config.sh`, `chmod +x`, and removes any
    stale `config.json`. **Build context must be `web/`** (the workspace root),
    since the build needs the lockfile and both packages — mirror the structure
    of `dashboard/Containerfile`. The entrypoint reduces to `MQTT_PREFIX`
    defaulting plus a single `envsubst` rendering `config.json.template`;
    validation now lives in TS.

11. **Integration tests.** Start `aedes` over WS in-process on an ephemeral port.
    Cover: retained-state replay populating the UI on connect; the reset happy
    path; each rejection payload from contract item 3; the 10s timeout path
    (fake timers); invalidate-on-reconnect and on device-offline; valve
    exclusivity plus the 5s pending timeout; the dialog focus trap and Escape
    ordering (happy-dom + Testing Library, `--preload` the registrator).
    Covers contract items 3, 4, 5, 6, 12.

12. **Docs.**
    - `web/README.md`: structure, `bun install`, dev with `.env`, build, test,
      container build, and the `MQTT_*` table.
    - `dashboard/README.md`: header note that `web/` is the current dashboard and
      this directory is **deprecated pending homelab cutover**; keep the existing
      homelab snippets but note the build context changes from `#main:dashboard`
      to `#main:web`.
    - Root `README.md`: point at `web/` for the dashboard.
    - `CLAUDE.md`: update the design reference from `dashboard/DESIGN.md` to
      `web/packages/ui/DESIGN.md`, and the UI path from `dashboard/site/` to
      `web/apps/dashboard/`.
    - Carry over the credential-exposure caveat (`dashboard/README.md:63`).

## Verification

```bash
cd web
bun install
bun run typecheck                     # tsc --noEmit, zero errors
bun test                              # unit + integration, all green

cd apps/dashboard
bun run build                         # dist/ contains index.html + hashed js/css
grep -c '\${' dist/index.html || true  # must find no unsubstituted templates

# container smoke test (podman or docker)
cd ../..                              # web/ is the build context
podman build -t hort-web -f apps/dashboard/Containerfile .
podman run --rm -p 8080:80 \
  -e MQTT_URL=ws://10.0.20.20:9001 \
  -e MQTT_USERNAME=u -e MQTT_PASSWORD=p hort-web
curl -s localhost:8080/config.json    # fully substituted, no ${...}
curl -sI localhost:8080/              # 200
```

Sanity checks the developer must also perform:
- `packages/mqtt` contains **no** import of `react`, `react-dom`, or any DOM
  global — grep to confirm.
- No `getElementById` / `querySelector` in application code (the port must be
  declarative); Testing Library queries in tests are fine.
- Grep the built CSS for `border-radius`, `box-shadow`, `transition`,
  `animation`, `gradient` — there must be no rounded corners, shadows,
  gradients, or motion.
- Report the final bundle size in `report.md`.

Manual verification is the user's (`bun dev` with a real `.env` against the live
broker, side-by-side against the old page). Note in `report.md` that this is
still outstanding.

## Risks and edge cases

- **Silent safety regression is the top risk.** The reset guard, staleness
  rules, and pending-dialog semantics are load-bearing.
  **Never weaken a safety condition to make a test pass.** If a contract item
  seems wrong, write it to `blockers.md` and stop.
- **Bundle size**: `mqtt` bundles to roughly 400KB unminified in prototyping;
  today's vendored `mqtt.min.js` is 310KB. Acceptable, but report the number.
- **Tailwind translation drift** from the hand-written CSS. Work rule by rule
  through `style.css`, do not eyeball it.
- **Bun's HTML-import API is young.** Pin exact Bun-adjacent versions. If a
  build flag behaves differently from the verified facts above, record it in
  `report.md`.
- **E-ink constraints**: Tailwind defaults contradict all four DESIGN.md rules
  (rounded corners, shadows, gradients, transitions). Override, do not inherit.
- **`noUncheckedIndexedAccess`** will surface real nullability in the entity
  registry lookups — handle it, do not disable the flag.
- Do **not** modify `kc868-a8.yaml`, `secrets*.yaml`, `observability/`, or
  `soil-node/`. Firmware is authoritative; the UI adapts to it.
- Do **not** touch `dashboard/site/` (except the `git mv` of `DESIGN.md`, which
  is at `dashboard/DESIGN.md`, one level up from `site/`).

## Open questions

None. All resolved during grilling.
