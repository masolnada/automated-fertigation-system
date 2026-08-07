#!/usr/bin/env bash
# Provision VM 102 (hort) and bring up the deploy stack. Idempotent.
#
#   host needs: Docker, git, age (installed below). Tailscale runs in a
#   container, so NO host-level Tailscale.
#
# Secrets: deploy/secrets.enc.env (age) is decrypted to deploy/.env. Provide the
# age identity at $AGE_IDENTITY (default ~/.ssh/id_dev), or place a ready-made
# deploy/.env next to this script before running.
set -euo pipefail

REPO_URL=${REPO_URL:-https://github.com/masolnada/automated-fertigation-system.git}
REPO_DIR=${REPO_DIR:-/opt/automated-fertigation-system}
AGE_IDENTITY=${AGE_IDENTITY:-$HOME/.ssh/id_dev}

install_pkgs() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "==> Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo systemctl enable --now docker
  fi
  if ! command -v git >/dev/null 2>&1 || ! command -v age >/dev/null 2>&1; then
    echo "==> Installing git + age..."
    sudo apt-get update -y
    sudo apt-get install -y git age
  fi
}

sync_repo() {
  if [ -d "$REPO_DIR/.git" ]; then
    echo "==> Updating repo..."
    sudo git -C "$REPO_DIR" pull --ff-only
  else
    echo "==> Cloning repo..."
    sudo git clone "$REPO_URL" "$REPO_DIR"
  fi
}

decrypt_env() {
  local dir="$REPO_DIR/deploy"
  if [ -f "$dir/.env" ]; then
    echo "==> deploy/.env present, leaving as-is"
    return
  fi
  if [ -f "$dir/secrets.enc.env" ] && [ -f "$AGE_IDENTITY" ]; then
    echo "==> Decrypting secrets.enc.env -> .env"
    sudo age --decrypt --identity "$AGE_IDENTITY" \
      --output "$dir/.env" "$dir/secrets.enc.env"
    sudo chmod 600 "$dir/.env"
  else
    echo "!! No deploy/.env and cannot decrypt (need $AGE_IDENTITY)." >&2
    echo "!! Decrypt locally and scp deploy/.env to $dir/ then re-run." >&2
    exit 1
  fi
}

up() {
  echo "==> Bringing up the stack..."
  sudo docker compose -f "$REPO_DIR/deploy/docker-compose.yml" up -d --build
}

install_pkgs
sync_repo
decrypt_env
up
echo "==> Done. Point dashboard.safs.milverds.com at this node's Tailscale IP:"
sudo docker exec hort-tailscale tailscale ip -4 2>/dev/null || true
