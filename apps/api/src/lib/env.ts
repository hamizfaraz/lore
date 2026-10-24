import { readFlags } from '@lore/shared/flags';
import { z } from 'zod';

/** Typed environment (plan section 14). Missing secrets are allowed in dev; features degrade. */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.string().default('http://localhost:3000'),
  API_PORT: z.coerce.number().default(4000),
  MCP_PORT: z.coerce.number().default(4100),
  MCP_URL: z.string().default('http://localhost:4100'),
  SESSION_COOKIE_DOMAIN: z.string().default('localhost'),
  BETTER_AUTH_SECRET: z.string().default('dev-secret-change-me-32-bytes-long!!'),
  BETTER_AUTH_URL: z.string().default('http://localhost:3000'),
  AI_MODE: z.enum(['mock', 'live']).default('mock'),
  DEMO_FAST_PROACTIVE: z.string().default('0'),
  DATABASE_URL: z.string().optional(),
  VALKEY_URL: z.string().default('redis://localhost:6379'),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('lore-media'),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  FACEBOOK_CLIENT_ID: z.string().optional(),
  FACEBOOK_CLIENT_SECRET: z.string().optional(),
  FB_GRAPH_VERSION: z.string().default('v24.0'),
  SOLANA_RPC_URL: z.string().default('https://api.devnet.solana.com'),
  SOLANA_VAULT_SECRET: z.string().optional(),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  /** dev only: story expiry override in minutes for the 8.1 acceptance test */
  STORY_TTL_MINUTES: z.coerce.number().default(24 * 60),
  /** dev only: when S3_* is unset, media is stored on disk here and served by the api with signed URLs */
  LOCAL_MEDIA_DIR: z.string().default('.data/media'),
});

const blank = (v: string | undefined) => (v === '' ? undefined : v);
const raw = Object.fromEntries(Object.entries(process.env).map(([k, v]) => [k, blank(v)]));

export const env = schema.parse(raw);
export const flags = readFlags(process.env);
export const isProd = env.NODE_ENV === 'production';
export type Env = typeof env;
