# Two-container deployment: nginx static + Express server

The dashboard ships as two images: an nginx image serving the static `dist/`
bundle, and the Express server. nginx proxies `/api` (including SSE) to the
server with `proxy_buffering off` so streamed snapshots are not held back. This
separates static serving from the device connection for independent scaling, and
lets the dashboard stay a generic build artifact whose compose/vhost/env wiring
lives in the separate homelab repo. Credentials are server-only env — the old
`config.json` render step and its template were removed, so the browser receives
nothing sensitive.
