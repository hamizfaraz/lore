#!/usr/bin/env bash
# One-time Vultr VM setup (Ubuntu 24.04, 4 vCPU / 8 GB, Dallas). Run as root on the new VM:
#   curl -fsSL https://raw.githubusercontent.com/<org>/lore/main/infra/vm-bootstrap.sh | bash   (or scp it)
# Then: add team SSH keys to /home/lore/.ssh/authorized_keys, put .env.prod in /home/lore/lore, run deploy.sh.
set -euo pipefail
apt-get update && apt-get install -y ca-certificates curl git ufw
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
apt-get update && apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
id lore >/dev/null 2>&1 || useradd -m -s /bin/bash -G docker lore
mkdir -p /home/lore/.ssh && cp -n /root/.ssh/authorized_keys /home/lore/.ssh/ 2>/dev/null || true
chown -R lore:lore /home/lore/.ssh
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 443/udp && ufw --force enable
fallocate -l 4G /swapfile 2>/dev/null && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile && echo '/swapfile none swap sw 0 0' >> /etc/fstab || true
echo "Now as lore: git clone <repo> ~/lore  (use a deploy key), copy .env.prod, then run infra/deploy.sh from a laptop."
