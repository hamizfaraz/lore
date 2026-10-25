# infra [C1]

| File | Purpose |
| --- | --- |
| `docker-compose.yml` | Production stack on one Vultr VM: caddy, web, api, mcp, worker, valkey |
| `Caddyfile` | `ourlore.tech` (web + `/v1`, `/api/auth`, `/socket.io` → api) and `mcp.ourlore.tech` → mcp |
| `api.Dockerfile` | api/mcp/worker image (node 22 slim + ffmpeg, tsup bundle, `pnpm deploy --prod`) |
| `web.Dockerfile` | Next.js standalone image (feature flags as build args) |
| `deploy.sh` | `VULTR_VM_IP=… ./infra/deploy.sh` — pull, build, up, db-setup, readiness check |
| `vm-bootstrap.sh` | One-time VM setup: Docker, `lore` user, firewall (22/80/443), swap |
| `s3-setup.sh`, `s3-cors.json` | Bucket `lore-media` (private) + CORS for presigned PUT/GET |
| `dev-native.sh` | Local Postgres+Timescale+pgvector and Valkey without Docker |

## First deploy checklist (Checkpoint A)

1. Vultr: create the VM (Ubuntu 24.04, 4 vCPU/8 GB, Dallas) and Object Storage; run `vm-bootstrap.sh` as root.
2. DNS at get.tech: A records `@`, `www`, `mcp` → VM IP, TTL 300.
3. Tiger: prod service → `DATABASE_URL` in `.env.prod`; from a laptop: `DATABASE_URL=<prod> pnpm db:push && pnpm db:setup`.
4. `S3_* … ./infra/s3-setup.sh`.
5. Copy `.env.prod` (from `.env.example`, `NODE_ENV=production`, `APP_URL=https://ourlore.tech`,
   `BETTER_AUTH_URL=https://ourlore.tech`, `SESSION_COOKIE_DOMAIN=.ourlore.tech`, `MCP_URL=https://mcp.ourlore.tech`,
   `AI_MODE=live`) to `/home/lore/lore/.env.prod` on the VM.
6. `VULTR_VM_IP=… ./infra/deploy.sh` → prints `/v1/ready`.
7. Before the demo: Vultr snapshot + Tiger fork (rollback in minutes).
