# Two-container deployment: nginx static + Express server

> **Superseded.** Deployment is now self-contained under `deploy/`: a
> Tailscale-only **Caddy** serves the static `dist/` (`file_server`), terminates
> TLS via Cloudflare DNS-01, and path-splits `/api/*` to the server. A dedicated
> Mosquitto broker runs alongside on the hort VM. nginx and the homelab wiring
> below are historical. See `deploy/README.md`.

The dashboard ships as two images: an nginx image serving the static `dist/`
bundle, and the Express server. nginx proxies `/api` (including SSE) to the
server with `proxy_buffering off` so streamed snapshots are not held back. This
separates static serving from the device connection for independent scaling, and
lets the dashboard stay a generic build artifact whose compose/vhost/env wiring
lives in the separate homelab repo. Credentials are server-only env — the old
`config.json` render step and its template were removed, so the browser receives
nothing sensitive.
