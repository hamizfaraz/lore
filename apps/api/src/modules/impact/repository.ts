import { analyticsEvents, and, asc, eq, gt, or, syncCursors } from '@lore/db';
import { uuidv7 } from '@lore/shared/ids';
import { getDb } from '../../lib/db';
import type { ImpactEventRow, SyncCursor } from './types';

export class ImpactRepository {
  async record(input: Omit<ImpactEventRow, 'eventId'>): Promise<ImpactEventRow> {
    const [row] = await getDb()
      .insert(analyticsEvents)
      .values({ eventId: uuidv7(), ...input })
      .returning();
    return row as ImpactEventRow;
  }

  async cursor(name = 'snowflake-impact'): Promise<SyncCursor> {
    const [row] = await getDb().select().from(syncCursors).where(eq(syncCursors.name, name)).limit(1);
    return row?.lastAt && row.lastEventId ? { lastAt: row.lastAt, lastEventId: row.lastEventId } : null;
  }

  async batchAfter(cursor: SyncCursor, limit = 500): Promise<ImpactEventRow[]> {
    const query = getDb().select().from(analyticsEvents);
    const rows = cursor
      ? await query
          .where(
            or(
              gt(analyticsEvents.at, cursor.lastAt),
              and(eq(analyticsEvents.at, cursor.lastAt), gt(analyticsEvents.eventId, cursor.lastEventId)),
            ),
          )
          .orderBy(asc(analyticsEvents.at), asc(analyticsEvents.eventId))
          .limit(Math.min(500, limit))
      : await query
          .orderBy(asc(analyticsEvents.at), asc(analyticsEvents.eventId))
          .limit(Math.min(500, limit));
    return rows as ImpactEventRow[];
  }

  async advance(name: string, cursor: Exclude<SyncCursor, null>) {
    await getDb()
      .insert(syncCursors)
      .values({ name, lastAt: cursor.lastAt, lastEventId: cursor.lastEventId })
      .onConflictDoUpdate({
        target: syncCursors.name,
        set: { lastAt: cursor.lastAt, lastEventId: cursor.lastEventId },
      });
  }

  async recent(since: Date): Promise<ImpactEventRow[]> {
    return (await getDb()
      .select()
      .from(analyticsEvents)
      .where(gt(analyticsEvents.at, since))
      .orderBy(asc(analyticsEvents.at), asc(analyticsEvents.eventId))) as ImpactEventRow[];
  }
}

export const impactRepository = new ImpactRepository();
