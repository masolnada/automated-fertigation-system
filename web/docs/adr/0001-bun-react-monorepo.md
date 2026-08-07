# The dashboard is a Bun/React/TS/Tailwind monorepo under web/

The dashboard is a Bun workspace at `web/` (apps + packages), not at the
repository root, so the firmware root stays free of `package.json`, `node_modules`
and a lockfile. React 19 + TypeScript (pinned to `typescript@5`, since `@7` breaks
the Bun types), Tailwind v4 built via `bun-plugin-tailwind` in a build script (the
CLI plugin form fails), and `bun test` with happy-dom — no Vite, Vitest or jsdom.
