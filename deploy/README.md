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

## Reaching the VM

**`ssh ubuntu@10.0.20.75`** (VLAN 20, DHCP reservation on the router).

> The reservation was added on 16-08-2026 while the VM held a `10.0.20.150`
> lease, so it takes effect on the next renewal or reboot. Until then the VM
> answers on `.150`; if `.75` refuses, try that.

Not over Tailscale. The tailnet node `hort` (`100.88.51.44`) is the *tailscale
container*, which only `caddy`, `hort` and `hort-server` share — nothing in that
namespace runs sshd, so `ssh ubuntu@hort` is refused, and no peer advertises a
subnet route to VLAN 20. The VM host deliberately runs no host-level Tailscale
(see `bootstrap.sh`), so the LAN address is the only way in.

Proxmox is no help either: the guest agent is off despite `agent: 1`, and `pve`
has no leg on VLAN 20. If the address is ever lost, recover it from the console
with `ssh root@pve` → `qm terminal 102` (needs `qm set 102 -serial0 socket` and
a reboot first).

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

## Redeploy (the routine case)

The VM tracks `main` from a checkout at `/opt/automated-fertigation-system`, so a
deploy is a pull plus a rebuild of the two images that carry app code. Push
first — the VM pulls from GitHub, not from your working tree.

```sh
ssh ubuntu@10.0.20.75 'cd /opt/automated-fertigation-system && sudo git pull --ff-only'
ssh ubuntu@10.0.20.75 'cd /opt/automated-fertigation-system \
  && sudo docker compose -f deploy/docker-compose.yml up -d --build hort hort-server'
```

Naming `hort hort-server` leaves `caddy`, `mosquitto` and `tailscale` running, so
neither TLS nor the broker is interrupted. Rebuild only one when only one
changed — the dashboard is `hort`, the API is `hort-server`.

**Back up the database first when the push contains a migration** (anything new
under `web/apps/server/drizzle/`). Migrations run automatically at server start,
and the volume is the only copy:

```sh
ssh ubuntu@10.0.20.75 'sudo bash -c "cp -a /var/lib/docker/volumes/deploy_hort_db/_data \
  /var/lib/docker/volumes/deploy_hort_db/_data.bak-\$(date +%Y%m%d-%H%M%S)"'

# list them back — the glob must expand as root, so `sudo bash -c` not plain `sudo ls`
ssh ubuntu@10.0.20.75 'sudo bash -c "ls -d /var/lib/docker/volumes/deploy_hort_db/_data.bak-*"'
```

Check it applied — the server image has no `sqlite3` binary, so ask Bun. The `?`
parameter avoids a third level of quoting inside the ssh command:

```sh
ssh ubuntu@10.0.20.75 'sudo docker exec hort-server bun -e "
import {Database} from \"bun:sqlite\";
const d = new Database(\"/data/hort.db\");
console.log(d.query(\"select name from sqlite_master where type = ?\").all(\"table\").map(r => r.name).join(\", \"));
"'
```

After the zone split (web ADR-0014) that lists `watering_events`, `zones` and
`output_assignments`.

Then the smoke test below. Roll back by checking out the previous commit and
rebuilding; restore the database only if a migration is at fault, since the
watering log accumulates while the controller is offline.

## First bring-up (one-time)

On the Proxmox host (disk is a 3.5 GB cloud image — grow it):
```sh
ssh root@pve 'qm disk resize 102 scsi0 16G && qm start 102'
```

Then, since the age identity is not kept on the VM, decrypt locally and copy the
`.env` over, then run bootstrap:
```sh
age --decrypt --identity ~/.ssh/id_dev --output /tmp/hort.env deploy/secrets.enc.env
scp /tmp/hort.env ubuntu@10.0.20.75:/tmp/deploy.env && rm /tmp/hort.env
ssh ubuntu@10.0.20.75 'sudo mkdir -p /opt/automated-fertigation-system/deploy \
  && sudo mv /tmp/deploy.env /opt/automated-fertigation-system/deploy/.env'
ssh ubuntu@10.0.20.75 'curl -fsSL <raw bootstrap.sh> | bash'   # or run deploy/bootstrap.sh
```

`bootstrap.sh` installs Docker + git + age, clones/pulls the repo, decrypts
`.env` if absent, and `docker compose up -d --build`.

## DNS

After the stack is up, read the node's Tailscale IP and add a Cloudflare **A
record** `dashboard.safs.milverds.com` -> that `100.x` IP (milverds.com is in
Cloudflare). Only tailnet devices can reach it.
```sh
ssh ubuntu@10.0.20.75 'sudo docker exec hort-tailscale tailscale ip -4'
```

## Smoke test

```sh
ssh ubuntu@10.0.20.75 'sudo docker ps --format "{{.Names}}\t{{.Status}}"'
ssh ubuntu@10.0.20.75 'sudo docker logs hort-server --tail 20'   # "listening on :4000", no migration errors

curl -s  https://dashboard.safs.milverds.com/api/health     # {"ok":true}
curl -s  https://dashboard.safs.milverds.com/api/snapshot   # brokerConnected true; zones and assignments intact
curl -N  https://dashboard.safs.milverds.com/api/stream     # incremental data:
# load the page; issue one command; confirm the device reacts
```

`deviceOnline: false` means the controller is off, not that the deploy failed —
it is portable and spends weeks in the field. `brokerConnected` is the flag that
says the server itself is healthy.

## Homelab cutover (phase 2, after this is verified)

Remove from the homelab repo: `garden/`, the `@hort` route in
`gateway/Caddyfile` (retires `hort.life.marcsolanadal.com`), `garden` in
`start.sh`, and the README garden entry. The broker and Grafana/Telegraf stay.
