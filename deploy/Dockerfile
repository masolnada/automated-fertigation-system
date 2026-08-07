# Ingress Caddy with the Cloudflare DNS plugin (for DNS-01, since the host is
# Tailscale-only and public ACME cannot reach it for HTTP-01/TLS-ALPN).
FROM caddy:builder AS builder
RUN xcaddy build --with github.com/caddy-dns/cloudflare

FROM caddy:latest
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
