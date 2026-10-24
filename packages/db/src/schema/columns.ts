import { customType, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Shared column helpers. Frozen with the scaffold; both owners import from here. */
export const citext = customType<{ data: string }>({ dataType: () => 'citext' });
export const tsvector = customType<{ data: string }>({ dataType: () => 'tsvector' });

export const id = (name = 'id') => uuid(name);
export const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
export const createdAt = () => ts('created_at').notNull().defaultNow();
