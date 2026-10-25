# LORE api image (api, mcp, worker entrypoints). Section 14: node:22-bookworm-slim + ffmpeg, multi-stage.
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/ai/package.json packages/ai/
COPY packages/tokens/package.json packages/tokens/
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
RUN pnpm --filter api build && pnpm --filter api deploy --prod /out

FROM node:22-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production SQL_DIR=/app/sql
WORKDIR /app
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/packages/db/sql ./sql
EXPOSE 4000 4100
CMD ["node", "dist/server.js"]
