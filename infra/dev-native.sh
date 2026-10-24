#!/usr/bin/env bash
# Local dev without Docker: start a natively built Postgres 17 (+TimescaleDB, pgvector) and Valkey.
# Binaries are expected at ~/.local/pgsql and ~/.local/valkey (see docs/PROJECT_CONTEXT_LOG.md).
# With Docker available, prefer: docker compose -f docker-compose.dev.yml up -d
set -euo pipefail
PG=$HOME/.local/pgsql/bin
DATA=${LORE_PGDATA:-$HOME/.local/lore-pgdata}
if [ ! -d "$DATA" ]; then
  "$PG/initdb" -D "$DATA" -U postgres --auth=trust >/dev/null
  echo "shared_preload_libraries = 'timescaledb'" >> "$DATA/postgresql.conf"
  echo "timescaledb.telemetry_level = off" >> "$DATA/postgresql.conf"
fi
"$PG/pg_ctl" -D "$DATA" -l "$DATA/server.log" -o "-p 5432" status >/dev/null 2>&1 || "$PG/pg_ctl" -D "$DATA" -l "$DATA/server.log" -o "-p 5432" start
sleep 1
"$PG/psql" -U postgres -h localhost -tc "select 1 from pg_database where datname='lore'" | grep -q 1 || "$PG/createdb" -U postgres -h localhost lore
if ! "$HOME/.local/valkey/bin/valkey-cli" ping >/dev/null 2>&1; then
  "$HOME/.local/valkey/bin/valkey-server" --port 6379 --daemonize yes --appendonly no --save "" --logfile "$HOME/.local/valkey.log"
fi
echo "postgres://postgres@localhost:5432/lore  ·  redis://localhost:6379"
