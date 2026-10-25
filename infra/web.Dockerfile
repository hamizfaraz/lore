# LORE web image: Next.js `output: 'standalone'` (section 14).
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /repo

FROM base AS build
ARG NEXT_PUBLIC_FEATURE_REELS=1
ARG NEXT_PUBLIC_FEATURE_EXPLORE=1
ARG NEXT_PUBLIC_FEATURE_GAMES_MEME=0
ARG NEXT_PUBLIC_FEATURE_GAMES_PICTIONARY=0
ARG NEXT_PUBLIC_FEATURE_FIND_FRIENDS=0
ARG NEXT_PUBLIC_FEATURE_FAMILY_STORY=0
ARG NEXT_PUBLIC_FEATURE_PODCAST=0
ARG NEXT_PUBLIC_FEATURE_IMPACT=0
ARG NEXT_PUBLIC_FEATURE_KEEPSAKES=0
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY=
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/ai/package.json packages/ai/
COPY packages/tokens/package.json packages/tokens/
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
RUN pnpm --filter web build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
