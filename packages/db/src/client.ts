import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index';

export type Db = ReturnType<typeof createDb>['db'];

/** Tiger Free Plan has no pooler: keep max 5 connections per process (section 14). */
export function createDb(url = process.env.DATABASE_URL, opts: { max?: number } = {}) {
  if (!url) throw new Error('DATABASE_URL is not set');
  const sql = postgres(url, {
    max: opts.max ?? 5,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
    onnotice: () => {},
  });
  const db = drizzle(sql, { schema, casing: 'snake_case' });
  return { db, sql };
}
