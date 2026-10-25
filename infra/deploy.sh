#!/usr/bin/env bash
# Deploy main to the Vultr VM (section 14 "Deploy"). Run from either laptop:  VULTR_VM_IP=1.2.3.4 ./infra/deploy.sh
set -euo pipefail
: "${VULTR_VM_IP:?set VULTR_VM_IP}"
BRANCH="${BRANCH:-main}"
DOMAIN="${DOMAIN:-ourlore.tech}"
ssh "lore@${VULTR_VM_IP}" bash -se <<REMOTE
set -euo pipefail
cd ~/lore
git fetch --all --prune
git checkout ${BRANCH}
git pull --ff-only origin ${BRANCH}
docker compose -f infra/docker-compose.yml build
docker compose -f infra/docker-compose.yml up -d --remove-orphans
docker compose -f infra/docker-compose.yml exec -T api node dist/scripts/db-setup.js
docker image prune -f >/dev/null
REMOTE
echo "Waiting for https://${DOMAIN}/v1/ready …"
for i in $(seq 1 30); do
  if curl -fsS "https://${DOMAIN}/v1/ready"; then echo; echo "deploy ok"; exit 0; fi
  sleep 5
done
echo "readiness check failed" >&2
exit 1
