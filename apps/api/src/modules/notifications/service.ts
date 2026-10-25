import { and, desc, eq, isNull, lt, sql } from '@lore/db';
import { notifications, pushSubscriptions } from '@lore/db';
import type { NotificationDTO, NotificationKind } from '@lore/shared/dto/notifications';
import { rooms } from '@lore/shared/events';
import { uuidv7 } from '@lore/shared/ids';
import webpush from 'web-push';
import { getDb } from '../../lib/db';
import { env } from '../../lib/env';
import { logger } from '../../lib/logger';
import { emit } from '../../lib/socket';

/** notifications business logic [C1]: in-app rows + realtime + web push to installed apps (section 8.3). */

type Payload = NotificationDTO['payload'];

let vapidReady = false;
function ensureVapid() {
  if (vapidReady || !env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return vapidReady;
  webpush.setVapidDetails(
    env.APP_URL.startsWith('http://localhost') ? 'mailto:team@ourlore.tech' : env.APP_URL,
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY,
  );
  vapidReady = true;
  return true;
}

const PUSH_KINDS: NotificationKind[] = [
  'draft_needs_approval',
  'plan_confirmed',
  'message',
  'post_published',
  'intro_request',
  'game_invite',
];

export function toDTO(r: typeof notifications.$inferSelect): NotificationDTO {
  return {
    id: r.id,
    kind: r.kind as NotificationKind,
    payload: r.payload as Payload,
    readAt: r.readAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

/** Create a notification for a user, emit `notification.created`, and web-push important kinds. */
export async function notify(
  userId: string,
  kind: NotificationKind,
  payload: Payload,
  opts: { push?: boolean; dedupeKey?: string } = {},
) {
  try {
    if (opts.dedupeKey) {
      const dup = await getDb()
        .select({ id: notifications.id })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.kind, kind),
            sql`${notifications.payload}->>'dedupeKey' = ${opts.dedupeKey}`,
            isNull(notifications.readAt),
          ),
        )
        .limit(1);
      if (dup.length) return null;
    }
    const [row] = await getDb()
      .insert(notifications)
      .values({
        id: uuidv7(),
        userId,
        kind,
        payload: { ...payload, ...(opts.dedupeKey ? { dedupeKey: opts.dedupeKey } : {}) },
      })
      .returning();
    const dto = toDTO(row);
    emit(rooms.user(userId), 'notification.created', dto);
    if (opts.push ?? PUSH_KINDS.includes(kind))
      void sendPush(userId, {
        title: payload.actorName ? `${payload.actorName}` : 'LORE',
        body: payload.text,
        href: payload.href,
      });
    return dto;
  } catch (err) {
    logger.warn({ err, kind }, 'notify failed');
    return null;
  }
}

export async function sendPush(userId: string, data: { title: string; body: string; href: string }) {
  if (!ensureVapid()) return;
  const subs = await getDb().select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(data),
          { TTL: 3600 },
        );
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410)
          await getDb().delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
      }
    }),
  );
}

export async function list(userId: string, cursor?: string, limit = 30) {
  const rows = await getDb()
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        cursor ? lt(notifications.createdAt, new Date(cursor)) : undefined,
      ),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(limit + 1);
  const items = rows.slice(0, limit).map(toDTO);
  return { items, nextCursor: rows.length > limit ? items[items.length - 1].createdAt : null };
}

export async function markRead(userId: string, ids?: string[]) {
  const where = ids?.length
    ? and(eq(notifications.userId, userId), sql`${notifications.id} = any(${ids}::uuid[])`)
    : eq(notifications.userId, userId);
  await getDb()
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(where, isNull(notifications.readAt)));
}

export async function unreadCount(userId: string) {
  const [r] = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return r?.n ?? 0;
}

export async function subscribePush(
  userId: string,
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
) {
  await getDb()
    .insert(pushSubscriptions)
    .values({ id: uuidv7(), userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    });
}
