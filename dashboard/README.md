# Fertigation dashboard

Static HTML+CSS+JS page (no framework, no backend) served by nginx. Talks MQTT over WebSockets directly to the broker: live state from the topics the device publishes, control by publishing to the command topics it subscribes to. MQTT.js 5.10.4 is vendored in `site/mqtt.min.js`.

This directory is a generic build artifact: no compose file, no domain, no credentials. All wiring lives in the homelab repo.

## Configuration (injected at container start)

`site/config.js` is rendered from `config.js.template` by `/docker-entrypoint.d/40-render-config.sh` using these environment variables:

| Variable | Example | Notes |
|---|---|---|
| `MQTT_URL` | `ws://10.0.20.20:9001` | Use `wss://…` when the page is served over HTTPS (mixed-content rule) |
| `MQTT_USERNAME` | `mosquitto` | |
| `MQTT_PASSWORD` | — | |
| `MQTT_PREFIX` | `kc868-a8` | Device topic prefix; defaults to `kc868-a8` |

## Homelab integration (snippets to add in the homelab repo)

Compose service — builds straight from this public repo:

```yaml
services:
  hort:
    build: https://github.com/masolnada/automated-fertigation-system.git#main:dashboard
    container_name: hort
    restart: unless-stopped
    environment:
      - MQTT_URL=wss://mqtt.${DOMAIN}
      - MQTT_USERNAME=${MQTT_USERNAME}
      - MQTT_PASSWORD=${MQTT_PASSWORD}
      - MQTT_PREFIX=kc868-a8
    networks:
      - proxy_net

networks:
  proxy_net:
    external: true
```

Caddyfile — the page vhost plus a wss proxy for the broker (an HTTPS page cannot open plain `ws://`):

```
@hort host hort.{$DOMAIN}
handle @hort {
	reverse_proxy hort:80
}

@mqtt host mqtt.{$DOMAIN}
handle @mqtt {
	reverse_proxy 10.0.20.20:9001
}
```

Homepage `services.yaml` tile:

```yaml
- Garden:
    - Hort:
        icon: mdi-sprinkler-variant
        href: https://hort.{{HOMEPAGE_VAR_DOMAIN}}
        description: Fertigation system
```

## Local development

```bash
cp site/config.js.template site/config.js   # fill in real values (gitignored)
python3 -m http.server -d site 8080
```

Note the MQTT credentials end up readable in the served `config.js` — fine for a LAN/Tailscale-only deployment, but treat the dashboard URL with the same trust as the broker itself.
