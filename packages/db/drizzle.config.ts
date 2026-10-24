import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgres://localhost:5432/lore' },
  // Timescale / extension objects are managed by sql/*.sql (pnpm db:setup), not drizzle.
  extensionsFilters: ['postgis'],
  tablesFilter: ['!_timescaledb_*', '!conv_activity_5m', '!engagement_topics_1d'],
  strict: false,
  verbose: true,
});
