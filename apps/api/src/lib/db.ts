import { type Db, createDb } from '@lore/db';
import { env } from './env';

let instance: { db: Db; sql: ReturnType<typeof createDb>['sql'] } | null = null;

/** Lazy singleton (pool max 5 per process, section 14). Tests may inject with `setDb`. */
export function getDb(): Db {
  if (!instance) instance = createDb(env.DATABASE_URL);
  return instance.db;
}
export function getSql() {
  getDb();
  return instance!.sql;
}
export function setDb(next: { db: Db; sql: any }) {
  instance = next;
}
export async function closeDb() {
  await instance?.sql.end({ timeout: 5 });
  instance = null;
}
export type { Db };
