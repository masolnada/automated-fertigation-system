# Deploy (self-contained)

Runs the fertigation dashboard + server on their own VM (`hort`, Proxmox VMID
102), behind their own Caddy, at **`dashboard.safs.milverds.com`**, reachable
**only over Tailscale**. Nothing here depends on the homelab repo.

## Topology (one Tailscale namespace)

```
dashboard.safs.milverds.com  (Tailscale-only)
        |
   [caddy]  TLS via Cloudflare DNS-01, path-split
     |  \_ /api/*  -> localhost:4000  (hort-server)
     \____ else    -> localhost:8080  (hort, static)

[hort-server] -- mqtt://homelab:1883 --> homelab mosquitto  (Tailscale MagicDNS)
```

Four containers: `tailscale` (node `hort`) owns the netns; `caddy`, `hort`
(static, Caddy `file_server`), and `hort-server` (Express/Bun, the only MQTT
client) share it, so they talk over `localhost`. `caddy-watcher` restarts the
sharers when `tailscale` restarts. Client and server are separate images —
redeploy either with `docker compose up -d --build hort` or `... hort-server`.

Why Tailscale MagicDNS for the broker: no hardcoded IPs. Why DNS-01 for TLS: the
host is Tailscale-only, so public ACME can't reach it for HTTP-01/TLS-ALPN.

## Secrets

Values live in the age-encrypted `secrets.enc.env` (committed); the plaintext
`.env` is gitignored. Same age recipient as `controller/` (`../controller/.age-recipients`,
identity `~/.ssh/id_dev`).

Edit:
```sh
age --decrypt --identity ~/.ssh/id_dev --output deploy/.env deploy/secrets.enc.env
# edit deploy/.env
age --encrypt -R controller/.age-recipients -o deploy/secrets.enc.env deploy/.env
```

Keys: `ACME_EMAIL`, `CLOUDFLARE_API_TOKEN` (scoped to the `milverds.com` zone,
Zone:DNS:Edit + Zone:Zone:Read), `TAILSCALE_AUTHKEY`, `MQTT_USERNAME`,
`MQTT_PASSWORD` (same as homelab mosquitto).

## Deploy VM 102

One-time on the Proxmox host (disk is a 3.5 GB cloud image — grow it):
```sh
ssh root@pve 'qm disk resize 102 scsi0 16G && qm start 102'
```

Then, since the age identity is not kept on the VM, decrypt locally and copy the
`.env` over, then run bootstrap:
```sh
age --decrypt --identity ~/.ssh/id_dev --output /tmp/hort.env deploy/secrets.enc.env
scp /tmp/hort.env ubuntu@<vm102>:/tmp/deploy.env && rm /tmp/hort.env
ssh ubuntu@<vm102> 'sudo mkdir -p /opt/automated-fertigation-system/deploy \
  && sudo mv /tmp/deploy.env /opt/automated-fertigation-system/deploy/.env'
ssh ubuntu@<vm102> 'curl -fsSL <raw bootstrap.sh> | bash'   # or run deploy/bootstrap.sh
```

`bootstrap.sh` installs Docker + git + age, clones/pulls the repo, decrypts
`.env` if absent, and `docker compose up -d --build`.

## DNS

After the stack is up, read the node's Tailscale IP and add a Cloudflare **A
record** `dashboard.safs.milverds.com` -> that `100.x` IP (milverds.com is in
Cloudflare). Only tailnet devices can reach it.
```sh
ssh ubuntu@<vm102> 'sudo docker exec hort-tailscale tailscale ip -4'
```

## Smoke test

```sh
curl -s  https://dashboard.safs.milverds.com/api/health   # {"ok":true}
curl -N  https://dashboard.safs.milverds.com/api/stream    # incremental data:
# load the page; issue one command; confirm the device reacts
```

## Homelab cutover (phase 2, after this is verified)

Remove from the homelab repo: `garden/`, the `@hort` route in
`gateway/Caddyfile` (retires `hort.life.marcsolanadal.com`), `garden` in
`start.sh`, and the README garden entry. The broker and Grafana/Telegraf stay.
