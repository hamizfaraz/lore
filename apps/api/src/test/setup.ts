import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** Load the repo .env for DB-backed tests; tests that need Postgres skip when DATABASE_URL is unset. */
const envFile = resolve(__dirname, '../../../../.env');
if (existsSync(envFile) && !process.env.CI) process.loadEnvFile(envFile);
process.env.AI_MODE = 'mock';
