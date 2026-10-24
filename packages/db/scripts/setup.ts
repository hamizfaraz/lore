/**
 * pnpm db:setup — runs packages/db/sql/*.sql in order after `drizzle-kit push`.
 * Each statement runs separately; failures are reported but do not stop later files
 * (e.g. a continuous aggregate the TimescaleDB version rejects), so the script is re-runnable.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const dir = process.env.SQL_DIR ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'sql');
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}
const sql = postgres(url, { max: 1, onnotice: () => {} });

function splitStatements(text: string): string[] {
  return text
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

let failures = 0;
for (const file of readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort()) {
  for (const stmt of splitStatements(readFileSync(join(dir, file), 'utf8'))) {
    try {
      await sql.unsafe(stmt);
    } catch (err) {
      failures++;
      console.warn(`[db:setup] ${file}: ${(err as Error).message}\n  ${stmt.slice(0, 120)}`);
    }
  }
  console.log(`[db:setup] ${file} done`);
}
await sql.end();
process.exit(failures > 0 && process.env.DB_SETUP_STRICT === '1' ? 1 : 0);
