import { randomBytes } from 'node:crypto';
import { and, desc, eq, gt, inArray, isNull, lt, or, pgArray, sql } from '@lore/db';
import {
  aiPersonas,
  conversationMembers,
  conversations,
  messageReactions,
  messages,
  socialAccounts,
  user,
} from '@lore/db';
import type { CardKind } from '@lore/shared/cards';
import type {
  ConversationDTO,
  ConversationRowDTO,
  MemberDTO,
  MessageDTO,
  SendMessageBody,
} from '@lore/shared/dto/chat';
import type { MemberRole, MessageKind, MuteScope } from '@lore/shared/enums';
import { rooms } from '@lore/shared/events';
import { uuidv7 } from '@lore/shared/ids';
import { type Actor, actorUserId } from '../../lib/actor';
import { getDb } from '../../lib/db';
import { badRequest, forbidden, notFound } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { emit, evictFromRoom } from '../../lib/socket';
import * as media from '../media/service';
import * as notifications from '../notifications/service';
import * as users from '../users/service';

/** chat business logic [C1] (section 8.2). Cross-boundary: postMessage, updateMessage (called by C2). */

type MessageRow = typeof messages.$inferSelect;
type MemberRow = typeof conversationMembers.$inferSelect;

// ── card payload resolvers (owners register in their module setup(); additive) ───────────────
type CardResolver = (
  refId: string,
  ctx: { viewerUserId: string | null; message: MessageRow },
) => Promise<unknown>;
const cardResolvers = new Map<string, CardResolver>();
/** Register how a card kind's payload is built for MessageDTO.card (e.g. C1 draft_card, C2 plan_card). */
export function registerCardResolver(kind: CardKind, fn: CardResolver) {
  cardResolvers.set(kind, fn);
}

// ── membership ────────────────────────────────────────────────────────────────────────
export async function membership(convId: string, userId: string): Promise<MemberRow | null> {
  const [m] = await getDb()
    .select()
    .from(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, convId),
        eq(conversationMembers.userId, userId),
        isNull(conversationMembers.removedAt),
      ),
    )
    .limit(1);
  return m ?? null;
}

export async function requireMember(convId: string, userId: string): Promise<MemberRow> {
  const m = await membership(convId, userId);
  if (!m) throw forbidden('You are not a member of this conversation');
  return m;
}

export const isAdmin = (m: MemberRow) => m.role === 'primary_admin' || m.role === 'admin';

export async function activeMembers(convId: string): Promise<MemberRow[]> {
  return getDb()
    .select()
    .from(conversationMembers)
    .where(and(eq(conversationMembers.conversationId, convId), isNull(conversationMembers.removedAt)));
}

async function getConv(convId: string) {
  const [c] = await getDb().select().from(conversations).where(eq(conversations.id, convId)).limit(1);
  if (!c) throw notFound('Conversation not found');
  return c;
}

// ── DTO builders ────────────────────────────────────────────────────────────────────────
export async function messageDTOs(rows: MessageRow[], viewerUserId: string | null): Promise<MessageDTO[]> {
  if (!rows.length) return [];
  const db = getDb();
  const ids = rows.map((r) => r.id);
  const replyIds = rows.map((r) => r.replyToId).filter(Boolean) as string[];
  const [cards, reactions, replies, personas, mediaList] = await Promise.all([
    users.userCards(rows.map((r) => r.senderUserId).filter(Boolean) as string[]),
    db.select().from(messageReactions).where(inArray(messageReactions.messageId, ids)),
    replyIds.length
      ? db.select().from(messages).where(inArray(messages.id, replyIds))
      : Promise.resolve([] as MessageRow[]),
    (async () => {
      const pids = [...new Set(rows.map((r) => r.personaId).filter(Boolean) as string[])];
      return pids.length ? db.select().from(aiPersonas).where(inArray(aiPersonas.id, pids)) : [];
    })(),
    media.mediaDTOs(rows.flatMap((r) => r.mediaIds)),
  ]);
  const replyCards = await users.userCards(replies.map((r) => r.senderUserId).filter(Boolean) as string[]);
  const personaById = new Map(
    await Promise.all(
      personas.map(
        async (p) =>
          [
            p.id,
            {
              id: p.id,
              name: p.name,
              avatarUrl: p.avatarMediaId ? await media.signedUrl(p.avatarMediaId, { thumb: true }) : null,
            },
          ] as const,
      ),
    ),
  );
  const mediaById = new Map(mediaList.map((m) => [m.id, m]));
  const out: MessageDTO[] = [];
  for (const r of rows) {
    const reply = replies.find((x) => x.id === r.replyToId);
    const grouped = new Map<string, string[]>();
    for (const x of reactions.filter((x) => x.messageId === r.id))
      grouped.set(x.emoji, [...(grouped.get(x.emoji) ?? []), x.userId]);
    let card: unknown;
    if (r.kind === 'card' && r.cardKind && r.cardRefId && cardResolvers.has(r.cardKind)) {
      card = await cardResolvers.get(r.cardKind)!(r.cardRefId, { viewerUserId, message: r }).catch((err) => {
        logger.warn({ err: (err as Error).message, kind: r.cardKind }, 'card resolver failed');
        return undefined;
      });
    }
    const s = r.senderUserId ? cards.get(r.senderUserId) : null;
    out.push({
      id: r.id,
      conversationId: r.conversationId,
      clientId: r.clientId,
      createdAt: r.createdAt.toISOString(),
      senderType: r.senderType,
      sender: s
        ? { userId: s.userId, displayName: s.displayName, handle: s.handle, avatarUrl: s.avatarUrl }
        : null,
      persona: r.personaId ? (personaById.get(r.personaId) ?? null) : null,
      kind: r.kind,
      body: r.deletedAt ? null : r.body,
      media: r.deletedAt
        ? []
        : (r.mediaIds.map((id) => mediaById.get(id)).filter(Boolean) as MessageDTO['media']),
      cardKind: r.cardKind,
      cardRefId: r.cardRefId,
      card,
      replyTo: reply
        ? {
            id: reply.id,
            body: reply.body,
            senderName: reply.senderUserId
              ? (replyCards.get(reply.senderUserId)?.displayName ?? 'Someone')
              : reply.senderType === 'ai'
                ? 'AI'
                : 'LORE',
          }
        : null,
      aiGenerated: r.aiGenerated,
      meta: (r.meta ?? {}) as MessageDTO['meta'],
      reactions: [...grouped.entries()].map(([emoji, userIds]) => ({ emoji, userIds })),
      editedAt: r.editedAt?.toISOString() ?? null,
      deletedAt: r.deletedAt?.toISOString() ?? null,
    });
  }
  return out;
}

function preview(r: MessageRow): string {
  if (r.deletedAt) return 'Message unsent';
  switch (r.kind) {
    case 'text':
    case 'system':
      return r.body ?? '';
    case 'voice':
      return 'Sent a voice message';
    case 'media':
      return r.mediaIds.length > 1 ? `Sent ${r.mediaIds.length} photos` : 'Sent a photo';
    case 'card':
      return (
        (
          {
            post_share: 'Shared a post',
            draft_card: 'Submitted a post for approval',
            plan_card: 'Shared plan ideas',
            plan_confirmed: 'Confirmed a plan',
            recap_card: 'Made a recap',
            game_invite: 'Started a game',
            game_result: 'Shared a game result',
            ai_image: 'Made an image',
          } as Record<string, string>
        )[r.cardKind ?? ''] ?? 'Shared something'
      );
  }
}

export async function inboxRow(convId: string, userId: string): Promise<ConversationRowDTO | null> {
  return (await inbox(userId, [convId]))[0] ?? null;
}

/** Inbox: conversations with last message and unread count, ordered by last activity (section 5 read patterns). */
export async function inbox(userId: string, onlyIds?: string[]): Promise<ConversationRowDTO[]> {
  const db = getDb();
  const mine = await db
    .select({ c: conversations, m: conversationMembers })
    .from(conversationMembers)
    .innerJoin(conversations, eq(conversations.id, conversationMembers.conversationId))
    .where(
      and(
        eq(conversationMembers.userId, userId),
        isNull(conversationMembers.removedAt),
        onlyIds ? inArray(conversations.id, onlyIds) : undefined,
      ),
    );
  if (!mine.length) return [];
  const convIds = mine.map((x) => x.c.id);
  const lastRows = await db.execute<{ conversation_id: string; id: string; created_at: string }>(sql`
    select l.conversation_id, l.id, l.created_at from unnest(${pgArray(convIds)}::uuid[]) as c(id)
    cross join lateral (
      select m.conversation_id, m.id, m.created_at from messages m
      where m.conversation_id = c.id order by m.created_at desc limit 1
    ) l`);
  const lastIds = (lastRows as unknown as { id: string }[]).map((r) => r.id);
  const last = lastIds.length ? await db.select().from(messages).where(inArray(messages.id, lastIds)) : [];
  const unread = await db.execute<{ conversation_id: string; n: number }>(sql`
    select cm.conversation_id, count(m.id)::int as n from conversation_members cm
    join messages m on m.conversation_id = cm.conversation_id
      and m.created_at > coalesce(cm.last_read_at, cm.joined_at)
      and (m.sender_user_id is null or m.sender_user_id <> ${userId})
      and m.sender_type <> 'system'
    where cm.user_id = ${userId} and cm.conversation_id = any(${pgArray(convIds)}::uuid[]) and cm.removed_at is null
    group by cm.conversation_id`);
  const unreadBy = new Map(
    (unread as unknown as { conversation_id: string; n: number }[]).map((r) => [r.conversation_id, r.n]),
  );
  const members = await db
    .select()
    .from(conversationMembers)
    .where(and(inArray(conversationMembers.conversationId, convIds), isNull(conversationMembers.removedAt)));
  const cards = await users.userCards([
    ...new Set([
      ...members.map((m) => m.userId),
      ...(last.map((l) => l.senderUserId).filter(Boolean) as string[]),
    ]),
  ]);
  const personaNames = new Map(
    (last.some((l) => l.personaId)
      ? await db
          .select({ id: aiPersonas.id, name: aiPersonas.name })
          .from(aiPersonas)
          .where(inArray(aiPersonas.id, last.map((l) => l.personaId).filter(Boolean) as string[]))
      : []
    ).map((p) => [p.id, p.name]),
  );
  const rows: ConversationRowDTO[] = mine.map(({ c, m }) => {
    const others = members.filter((x) => x.conversationId === c.id && x.userId !== userId);
    const l = last.find((x) => x.conversationId === c.id);
    const title =
      c.title ||
      others
        .map((o) =>
          c.kind === 'dm' ? cards.get(o.userId)?.displayName : cards.get(o.userId)?.displayName.split(' ')[0],
        )
        .filter(Boolean)
        .join(', ') ||
      'Just you';
    const lastSender =
      l?.senderUserId === userId
        ? 'You'
        : l?.senderType === 'ai'
          ? (personaNames.get(l.personaId ?? '') ?? 'AI')
          : l?.senderUserId && c.kind === 'group'
            ? cards.get(l.senderUserId)?.displayName.split(' ')[0]
            : null;
    return {
      id: c.id,
      kind: c.kind,
      title,
      avatars: (others.length ? others : members.filter((x) => x.conversationId === c.id))
        .slice(0, 2)
        .map((o) => cards.get(o.userId)?.avatarUrl ?? null),
      lastMessage: l
        ? {
            preview: preview(l),
            at: l.createdAt.toISOString(),
            senderName: lastSender ?? null,
            isAi: l.senderType === 'ai',
          }
        : null,
      unreadCount: unreadBy.get(c.id) ?? 0,
      pinned: Boolean(m.pinnedAt),
      updatedAt: (l?.createdAt ?? c.createdAt).toISOString(),
    };
  });
  return rows.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
}

export async function memberDTOs(convId: string): Promise<MemberDTO[]> {
  const ms = await activeMembers(convId);
  const cards = await users.userCards(ms.map((m) => m.userId));
  const order: Record<MemberRole, number> = { primary_admin: 0, admin: 1, publisher: 2, member: 3 };
  return ms
    .sort((a, b) => order[a.role] - order[b.role] || a.joinedAt.getTime() - b.joinedAt.getTime())
    .map((m) => {
      const c = cards.get(m.userId)!;
      return {
        userId: m.userId,
        displayName: c.displayName,
        handle: c.handle,
        avatarUrl: c.avatarUrl,
        role: m.role,
        muteScope: m.muteUntil && m.muteUntil > new Date() ? m.muteScope : null,
        muteUntil: m.muteUntil && m.muteUntil > new Date() ? m.muteUntil.toISOString() : null,
        aiHistoryConsent: m.aiHistoryConsent,
        lastReadAt: m.lastReadAt?.toISOString() ?? null,
      };
    });
}

export async function getConversation(convId: string, userId: string): Promise<ConversationDTO> {
  const me = await requireMember(convId, userId);
  const c = await getConv(convId);
  const [members, persona, group] = await Promise.all([
    memberDTOs(convId),
    getDb().select().from(aiPersonas).where(eq(aiPersonas.conversationId, convId)).limit(1),
    c.groupAccountId ? users.accountSummary(c.groupAccountId) : Promise.resolve(null),
  ]);
  const others = members.filter((m) => m.userId !== userId);
  const p = persona[0];
  return {
    id: c.id,
    kind: c.kind,
    title: c.title || others.map((o) => o.displayName).join(', ') || 'Just you',
    avatarUrl: c.avatarMediaId
      ? await media.signedUrl(c.avatarMediaId, { thumb: true })
      : c.kind === 'dm'
        ? (others[0]?.avatarUrl ?? null)
        : null,
    members,
    myRole: me.role,
    persona: p
      ? {
          id: p.id,
          name: p.name,
          avatarUrl: p.avatarMediaId ? await media.signedUrl(p.avatarMediaId, { thumb: true }) : null,
          enabled: p.enabled,
        }
      : null,
    groupAccount: group,
    createdAt: c.createdAt.toISOString(),
  };
}

// ── create ────────────────────────────────────────────────────────────────────────────
export async function createConversation(
  userId: string,
  input: { kind: 'dm' | 'group'; memberUserIds: string[]; title?: string },
) {
  const others = [...new Set(input.memberUserIds.filter((u) => u !== userId))];
  if (!others.length) throw badRequest('Add at least one person');
  const db = getDb();
  const found = await db.select({ id: user.id }).from(user).where(inArray(user.id, others));
  if (found.length !== others.length) throw badRequest('Unknown user');
  if (input.kind === 'dm') {
    if (others.length !== 1) throw badRequest('A DM has exactly two people');
    const { assertNotBlocked } = await import('../social/blocks');
    await assertNotBlocked(userId, others[0]!);
    const existing = await db.execute<{ id: string }>(sql`
      select c.id from conversations c
      join conversation_members a on a.conversation_id = c.id and a.user_id = ${userId} and a.removed_at is null
      join conversation_members b on b.conversation_id = c.id and b.user_id = ${others[0]} and b.removed_at is null
      where c.kind = 'dm' limit 1`);
    const ex = (existing as unknown as { id: string }[])[0];
    if (ex) return getConversation(ex.id, userId);
  }
  const id = uuidv7();
  await db.transaction(async (tx) => {
    await tx.insert(conversations).values({
      id,
      kind: input.kind,
      title: input.kind === 'group' ? input.title?.trim() || null : null,
      createdByUserId: userId,
    });
    await tx.insert(conversationMembers).values([
      {
        conversationId: id,
        userId,
        role: input.kind === 'group' ? 'primary_admin' : 'member',
        lastReadAt: new Date(),
      },
      ...others.map((u) => ({ conversationId: id, userId: u, role: 'member' as const })),
    ]);
  });
  if (input.kind === 'group') {
    const me = (await users.userCards([userId])).get(userId)!;
    await postMessage(
      id,
      { kind: 'system', body: `${me.displayName.split(' ')[0]} created the group` },
      { type: 'system' },
    );
  }
  for (const u of [userId, ...others]) void emitInboxRow(id, u);
  return getConversation(id, userId);
}

// ── messages ──────────────────────────────────────────────────────────────────────────
const MSG_PAGE = 50;

export async function listMessages(convId: string, userId: string, before?: string, after?: string) {
  await requireMember(convId, userId);
  const db = getDb();
  const ref = before ? await messageById(before) : after ? await messageById(after) : null;
  // Compare against the stored timestamp in SQL (microsecond precision; a JS Date would truncate to ms).
  const refTs = ref
    ? sql`(select m2.created_at from messages m2 where m2.id = ${ref.id} and m2.conversation_id = ${convId} limit 1)`
    : null;
  const rows = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, convId),
        before && refTs
          ? sql`(${messages.createdAt}, ${messages.id}) < (${refTs}, ${ref!.id}::uuid)`
          : undefined,
        after && refTs
          ? sql`(${messages.createdAt}, ${messages.id}) > (${refTs}, ${ref!.id}::uuid)`
          : undefined,
      ),
    )
    .orderBy(after ? messages.createdAt : desc(messages.createdAt), after ? messages.id : desc(messages.id))
    .limit(after ? 200 : MSG_PAGE + 1);
  const page = after ? rows : rows.slice(0, MSG_PAGE);
  const ordered = after ? page : [...page].reverse();
  return {
    items: await messageDTOs(ordered, userId),
    nextCursor: !after && rows.length > MSG_PAGE ? ordered[0].id : null,
  };
}

/** UUIDv7 encodes its timestamp, so lookups by id can narrow to a chunk window on the hypertable. */
function uuidTime(id: string): Date | null {
  const hex = id.replace(/-/g, '').slice(0, 12);
  const ms = Number.parseInt(hex, 16);
  return Number.isFinite(ms) && ms > 1_600_000_000_000 ? new Date(ms) : null;
}

export async function messageById(id: string): Promise<MessageRow | null> {
  const t = uuidTime(id);
  const [r] = await getDb()
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.id, id),
        t
          ? and(
              gt(messages.createdAt, new Date(t.getTime() - 60_000)),
              lt(messages.createdAt, new Date(t.getTime() + 24 * 3600_000)),
            )
          : undefined,
      ),
    )
    .limit(1);
  if (r || !t) return r ?? null;
  const [r2] = await getDb().select().from(messages).where(eq(messages.id, id)).limit(1);
  return r2 ?? null;
}

function mutedFor(m: MemberRow, scope: MuteScope) {
  return m.muteUntil && m.muteUntil > new Date() && m.muteScope === scope;
}

export type PostMessageInput = {
  kind: MessageKind;
  body?: string | null;
  mediaIds?: string[];
  cardKind?: CardKind | null;
  cardRefId?: string | null;
  replyToId?: string | null;
  meta?: Record<string, unknown>;
  clientId?: string | null;
  /** for actor.type === 'ai' */
  personaId?: string | null;
};

export type MessagePatch = {
  body?: string | null;
  meta?: Record<string, unknown>;
  cardKind?: CardKind | null;
  cardRefId?: string | null;
  /** re-render the card payload for clients (card refresh) */
  refreshCard?: boolean;
};

/**
 * Cross-boundary [C1 implements, C2 calls]: insert + emit `message.created`. AI actors set ai_generated.
 * Human sends are idempotent on clientId; after insert, persona.onMessage(msg) runs fire-and-forget.
 */
export async function postMessage(
  convId: string,
  input: PostMessageInput,
  actor: Actor,
): Promise<MessageDTO> {
  const db = getDb();
  const uid = actorUserId(actor);
  if (uid) {
    const m = await requireMember(convId, uid);
    if (mutedFor(m, 'chat') && input.kind !== 'system')
      throw forbidden('An admin muted you in this chat for now');
    if (input.clientId) {
      const [dup] = await db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, convId),
            eq(messages.senderUserId, uid),
            eq(messages.clientId, input.clientId),
          ),
        )
        .limit(1);
      if (dup) return (await messageDTOs([dup], uid))[0];
    }
    if (input.mediaIds?.length) await media.assertUsable(input.mediaIds, uid);
  } else {
    await getConv(convId);
  }
  if (input.kind === 'text' && !input.body?.trim()) throw badRequest('Message is empty');
  if ((input.kind === 'media' || input.kind === 'voice') && !input.mediaIds?.length)
    throw badRequest('Attach media');
  if (input.kind === 'card' && (!input.cardKind || !input.cardRefId))
    throw badRequest('Card needs kind and ref');
  if (input.replyToId) {
    const rt = await messageById(input.replyToId);
    if (!rt || rt.conversationId !== convId) throw badRequest('Bad reply');
  }
  const isAi = actor.type === 'ai';
  const [row] = await db
    .insert(messages)
    .values({
      id: uuidv7(),
      conversationId: convId,
      senderType: isAi ? 'ai' : actor.type === 'system' ? 'system' : 'human',
      senderUserId: uid,
      personaId: isAi ? (input.personaId ?? actor.personaId) : null,
      clientId: input.clientId ?? null,
      kind: input.kind,
      body: input.body?.trim() ?? null,
      mediaIds: input.mediaIds ?? [],
      cardKind: input.cardKind ?? null,
      cardRefId: input.cardRefId ?? null,
      replyToId: input.replyToId ?? null,
      aiGenerated: isAi,
      meta: input.meta ?? {},
    })
    .returning();
  await db.update(conversations).set({ lastMessageAt: row.createdAt }).where(eq(conversations.id, convId));
  if (uid)
    await db
      .update(conversationMembers)
      .set({ lastReadAt: row.createdAt })
      .where(and(eq(conversationMembers.conversationId, convId), eq(conversationMembers.userId, uid)));
  const [dto] = await messageDTOs([row], uid);
  emit(rooms.conv(convId), 'message.created', dto);
  void fanOut(convId, row, dto);
  if (row.senderType === 'human') {
    import('../persona/service')
      .then((p) => p.onMessage(dto))
      .catch((err) => {
        if (err?.name !== 'NotImplemented') logger.warn({ err: err?.message }, 'persona.onMessage failed');
      });
  }
  return dto;
}

/** Inbox rows + push to other members. */
async function fanOut(convId: string, row: MessageRow, dto: MessageDTO) {
  try {
    const ms = await activeMembers(convId);
    await Promise.allSettled(ms.map((m) => emitInboxRow(convId, m.userId)));
    if (row.senderType === 'system') return;
    const name = dto.sender?.displayName ?? dto.persona?.name ?? 'LORE';
    for (const m of ms) {
      if (m.userId === row.senderUserId) continue;
      if (m.muteUntil && m.muteUntil > new Date() && m.muteScope === null) continue;
      await notifications
        .sendPush(m.userId, { title: name, body: preview(row), href: `/c/${convId}` })
        .catch((error) => logger.warn({ error, userId: m.userId }, 'push notification failed'));
    }
  } catch (err) {
    logger.warn({ err }, 'fanOut failed');
  }
}

export async function emitInboxRow(convId: string, userId: string) {
  const row = await inboxRow(convId, userId);
  if (row) emit(rooms.user(userId), 'conversation.updated', row);
}

/** Cross-boundary [C1 implements, C2 calls]: patch + emit `message.updated` (transcripts, card refresh). */
export async function updateMessage(id: string, patch: MessagePatch): Promise<MessageDTO | null> {
  const row = await messageById(id);
  if (!row) return null;
  const set: Partial<MessageRow> = {};
  if (patch.body !== undefined) set.body = patch.body;
  if (patch.meta !== undefined) set.meta = { ...(row.meta ?? {}), ...patch.meta };
  if (patch.cardKind !== undefined) set.cardKind = patch.cardKind;
  if (patch.cardRefId !== undefined) set.cardRefId = patch.cardRefId;
  let updated = row;
  if (Object.keys(set).length) {
    [updated] = await getDb()
      .update(messages)
      .set(set)
      .where(and(eq(messages.id, id), eq(messages.createdAt, row.createdAt)))
      .returning();
  }
  const [dto] = await messageDTOs([updated], null);
  emit(rooms.conv(row.conversationId), 'message.updated', {
    id,
    conversationId: row.conversationId,
    patch: dto,
  });
  return dto;
}

/** Refresh a card message for every viewer (e.g. draft approvals changed). Finds the message by card ref. */
export async function refreshCard(convId: string, cardKind: CardKind, cardRefId: string) {
  const rows = await getDb()
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, convId),
        eq(messages.cardKind, cardKind),
        eq(messages.cardRefId, cardRefId),
      ),
    )
    .orderBy(desc(messages.createdAt))
    .limit(3);
  for (const r of rows) await updateMessage(r.id, { refreshCard: true });
}

export async function send(convId: string, userId: string, body: SendMessageBody) {
  return postMessage(
    convId,
    {
      kind: body.kind,
      body: body.body,
      mediaIds: body.mediaIds,
      replyToId: body.replyToId,
      clientId: body.clientId,
      cardKind: (body.cardKind as CardKind) ?? null,
      cardRefId: body.cardRefId ?? null,
      meta: body.meta,
    },
    { type: 'user', userId },
  );
}

export async function unsend(userId: string, messageId: string) {
  const row = await messageById(messageId);
  if (!row) throw notFound();
  if (row.senderUserId !== userId) throw forbidden();
  await getDb()
    .update(messages)
    .set({ deletedAt: new Date() })
    .where(and(eq(messages.id, messageId), eq(messages.createdAt, row.createdAt)));
  return updateMessage(messageId, {});
}

export async function markRead(convId: string, userId: string) {
  await requireMember(convId, userId);
  await getDb()
    .update(conversationMembers)
    .set({ lastReadAt: new Date() })
    .where(and(eq(conversationMembers.conversationId, convId), eq(conversationMembers.userId, userId)));
  void emitInboxRow(convId, userId);
  // read receipts for DMs: others refresh member lastReadAt
  emit(rooms.conv(convId), 'typing', { conversationId: convId, userId, on: false });
}

export async function react(userId: string, messageId: string, emoji: string, on: boolean) {
  const row = await messageById(messageId);
  if (!row) throw notFound();
  await requireMember(row.conversationId, userId);
  if (on) {
    // one reaction per user per message, like Instagram: replace previous
    await getDb()
      .delete(messageReactions)
      .where(and(eq(messageReactions.messageId, messageId), eq(messageReactions.userId, userId)));
    await getDb().insert(messageReactions).values({ messageId, userId, emoji }).onConflictDoNothing();
  } else
    await getDb()
      .delete(messageReactions)
      .where(
        and(
          eq(messageReactions.messageId, messageId),
          eq(messageReactions.userId, userId),
          eq(messageReactions.emoji, emoji),
        ),
      );
  return updateMessage(messageId, {});
}

// ── members ───────────────────────────────────────────────────────────────────────────
export async function addMembers(convId: string, actorId: string, userIds: string[]) {
  const me = await requireMember(convId, actorId);
  const c = await getConv(convId);
  if (c.kind !== 'group') throw badRequest('Only group chats can add people');
  if (!isAdmin(me)) throw forbidden('Only admins can add people');
  const db = getDb();
  const names: string[] = [];
  const cards = await users.userCards(userIds);
  for (const u of userIds) {
    await db
      .insert(conversationMembers)
      .values({ conversationId: convId, userId: u, role: 'member' })
      .onConflictDoUpdate({
        target: [conversationMembers.conversationId, conversationMembers.userId],
        set: { removedAt: null, joinedAt: new Date(), role: 'member' },
      });
    names.push(cards.get(u)?.displayName.split(' ')[0] ?? 'Someone');
  }
  const actor = (await users.userCards([actorId])).get(actorId)!;
  await postMessage(
    convId,
    { kind: 'system', body: `${actor.displayName.split(' ')[0]} added ${names.join(', ')}` },
    { type: 'system' },
  );
  return memberDTOs(convId);
}

export async function removeMember(convId: string, actorId: string, targetId: string) {
  const me = await requireMember(convId, actorId);
  const target = await requireMember(convId, targetId).catch(() => null);
  if (!target) throw notFound('Not a member');
  const leaving = actorId === targetId;
  if (!leaving && !isAdmin(me)) throw forbidden('Only admins can remove people');
  if (!leaving && target.role === 'primary_admin') throw forbidden("The group's creator can't be removed");
  await getDb()
    .update(conversationMembers)
    .set({ removedAt: new Date() })
    .where(and(eq(conversationMembers.conversationId, convId), eq(conversationMembers.userId, targetId)));
  if (leaving && target.role === 'primary_admin') {
    const [next] = await getDb()
      .select()
      .from(conversationMembers)
      .where(and(eq(conversationMembers.conversationId, convId), isNull(conversationMembers.removedAt)))
      .orderBy(conversationMembers.joinedAt)
      .limit(1);
    if (next)
      await getDb()
        .update(conversationMembers)
        .set({ role: 'primary_admin' })
        .where(
          and(eq(conversationMembers.conversationId, convId), eq(conversationMembers.userId, next.userId)),
        );
  }
  await evictFromRoom(targetId, rooms.conv(convId));
  const cards = await users.userCards([actorId, targetId]);
  await postMessage(
    convId,
    {
      kind: 'system',
      body: leaving
        ? `${cards.get(targetId)!.displayName.split(' ')[0]} left`
        : `${cards.get(actorId)!.displayName.split(' ')[0]} removed ${cards.get(targetId)!.displayName.split(' ')[0]}`,
    },
    { type: 'system' },
  );
  emit(rooms.user(targetId), 'conversation.updated', {
    id: convId,
    kind: 'group',
    title: '',
    avatars: [],
    lastMessage: null,
    unreadCount: 0,
    pinned: false,
    updatedAt: new Date(0).toISOString(),
  });
  return memberDTOs(convId);
}

export async function setRole(convId: string, actorId: string, targetId: string, role: MemberRole) {
  const me = await requireMember(convId, actorId);
  if (me.role !== 'primary_admin' && !(me.role === 'admin' && role !== 'admin' && role !== 'primary_admin'))
    throw forbidden('Only the primary admin can change admins');
  if (role === 'primary_admin') throw badRequest('Use transfer to change the primary admin');
  const target = await requireMember(convId, targetId);
  if (target.role === 'primary_admin') throw forbidden();
  await getDb()
    .update(conversationMembers)
    .set({ role })
    .where(and(eq(conversationMembers.conversationId, convId), eq(conversationMembers.userId, targetId)));
  await getDb()
    .insert((await import('@lore/db')).auditLog)
    .values({
      id: uuidv7(),
      actorType: 'user',
      actorId,
      action: 'member.role',
      targetType: 'conversation',
      targetId: convId,
      meta: { userId: targetId, role },
    });
  return memberDTOs(convId);
}

/**
 * Temporary mute with scope (chat, games, publishing) and duration (section 8.2 step 6).
 * Admins mute another member; anyone can mute the conversation for themselves (scope null = notifications).
 */
export async function mute(
  convId: string,
  actorId: string,
  input: { userId?: string; scope: MuteScope | null; minutes: number | null },
) {
  const me = await requireMember(convId, actorId);
  const target = input.userId ?? actorId;
  if (target !== actorId && !isAdmin(me)) throw forbidden('Only admins can mute members');
  if (target !== actorId && !input.scope) throw badRequest('Choose what to mute');
  const until = input.minutes
    ? new Date(Date.now() + input.minutes * 60_000)
    : input.minutes === null && input.scope === null && target === actorId
      ? new Date('2999-01-01')
      : null;
  await getDb()
    .update(conversationMembers)
    .set({ muteScope: input.scope, muteUntil: input.minutes === 0 ? null : until })
    .where(and(eq(conversationMembers.conversationId, convId), eq(conversationMembers.userId, target)));
  return memberDTOs(convId);
}

export async function setAiConsent(convId: string, userId: string, consent: boolean) {
  await requireMember(convId, userId);
  await getDb()
    .update(conversationMembers)
    .set({ aiHistoryConsent: consent })
    .where(and(eq(conversationMembers.conversationId, convId), eq(conversationMembers.userId, userId)));
}

export async function pin(convId: string, userId: string, on: boolean) {
  await requireMember(convId, userId);
  await getDb()
    .update(conversationMembers)
    .set({ pinnedAt: on ? new Date() : null })
    .where(and(eq(conversationMembers.conversationId, convId), eq(conversationMembers.userId, userId)));
  void emitInboxRow(convId, userId);
}

export async function rename(convId: string, userId: string, title: string) {
  const me = await requireMember(convId, userId);
  if (!isAdmin(me)) throw forbidden();
  await getDb().update(conversations).set({ title }).where(eq(conversations.id, convId));
  const name = (await users.userCards([userId])).get(userId)!.displayName.split(' ')[0];
  await postMessage(convId, { kind: 'system', body: `${name} named the group ${title}` }, { type: 'system' });
}

export async function sharedMedia(convId: string, userId: string) {
  await requireMember(convId, userId);
  const rows = await getDb()
    .select({ ids: messages.mediaIds })
    .from(messages)
    .where(and(eq(messages.conversationId, convId), eq(messages.kind, 'media'), isNull(messages.deletedAt)))
    .orderBy(desc(messages.createdAt))
    .limit(60);
  return media.mediaDTOs(rows.flatMap((r) => r.ids));
}

/**
 * Transcript for the AI context builder (section 7 transcript block). Messages from members with
 * ai_history_consent = false are replaced with "[message hidden from AI]". C2's persona worker uses this.
 */
export async function transcriptForAi(convId: string, limit = 40) {
  const db = getDb();
  const [rows, ms] = await Promise.all([
    db
      .select()
      .from(messages)
      .where(and(eq(messages.conversationId, convId), isNull(messages.deletedAt)))
      .orderBy(desc(messages.createdAt))
      .limit(limit),
    db.select().from(conversationMembers).where(eq(conversationMembers.conversationId, convId)),
  ]);
  const hidden = new Set(ms.filter((m) => !m.aiHistoryConsent).map((m) => m.userId));
  const cards = await users.userCards(rows.map((r) => r.senderUserId).filter(Boolean) as string[]);
  const mediaRows = await media.mediaDTOs(rows.flatMap((r) => r.mediaIds));
  const byId = new Map(mediaRows.map((m) => [m.id, m]));
  return rows.reverse().map((r) => {
    const name = r.senderUserId
      ? (cards.get(r.senderUserId)?.displayName ?? 'Someone')
      : r.senderType === 'ai'
        ? 'AI'
        : 'LORE';
    const hide = r.senderUserId != null && hidden.has(r.senderUserId);
    let text = r.body ?? '';
    if (!hide) {
      for (const id of r.mediaIds) {
        const m = byId.get(id);
        if (m?.kind === 'audio') text += ` [voice: ${m.transcript ?? 'transcribing'}]`;
        else if (m) text += ` [photo${m.altText ? `: ${m.altText}` : ''}]`;
      }
      if (r.kind === 'card') text += ` [card: ${r.cardKind}]`;
    }
    return {
      id: r.id,
      at: r.createdAt.toISOString(),
      senderType: r.senderType,
      senderUserId: r.senderUserId,
      name,
      text: hide ? '[message hidden from AI]' : text.trim(),
    };
  });
}

// ── guest join (judges) ────────────────────────────────────────────────────────────────
export async function createJoinLink(convId: string, userId: string) {
  const me = await requireMember(convId, userId);
  if (!isAdmin(me)) throw forbidden('Only admins can create invite links');
  const c = await getConv(convId);
  const slug =
    c.joinSlug ??
    `${
      (c.title ?? 'group')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 24) || 'group'
    }-${randomBytes(2).toString('hex')}`;
  const code = randomBytes(4).toString('hex');
  await getDb()
    .update(conversations)
    .set({ joinSlug: slug, joinCode: code })
    .where(eq(conversations.id, convId));
  return { slug, code, path: `/join/${slug}?code=${code}` };
}

export async function joinInfo(slug: string) {
  const [c] = await getDb().select().from(conversations).where(eq(conversations.joinSlug, slug)).limit(1);
  if (!c) throw notFound('Invite not found');
  const ms = await memberDTOs(c.id);
  return {
    title: c.title ?? 'Group chat',
    memberCount: ms.length,
    avatars: ms.slice(0, 3).map((m) => m.avatarUrl),
  };
}

export async function joinWithCode(slug: string, code: string, userId: string) {
  const [c] = await getDb().select().from(conversations).where(eq(conversations.joinSlug, slug)).limit(1);
  if (!c || !c.joinCode || c.joinCode !== code) throw forbidden('This invite link is invalid or expired');
  await getDb()
    .insert(conversationMembers)
    .values({ conversationId: c.id, userId, role: 'member' })
    .onConflictDoUpdate({
      target: [conversationMembers.conversationId, conversationMembers.userId],
      set: { removedAt: null },
    });
  const name = (await users.userCards([userId])).get(userId)!.displayName;
  await postMessage(c.id, { kind: 'system', body: `${name} joined as a guest` }, { type: 'system' });
  return { conversationId: c.id };
}

/** Guest accounts and their messages expire automatically (section 15). */
export async function expireGuests() {
  const db = getDb();
  const expired = await db
    .select({ id: user.id })
    .from(user)
    .where(and(lt(user.guestExpiresAt, new Date())));
  for (const g of expired) {
    const ms = await db
      .select()
      .from(conversationMembers)
      .where(and(eq(conversationMembers.userId, g.id), isNull(conversationMembers.removedAt)));
    await db
      .update(messages)
      .set({ deletedAt: new Date() })
      .where(and(eq(messages.senderUserId, g.id), isNull(messages.deletedAt)));
    for (const m of ms) {
      await db
        .update(conversationMembers)
        .set({ removedAt: new Date() })
        .where(
          and(eq(conversationMembers.conversationId, m.conversationId), eq(conversationMembers.userId, g.id)),
        );
      await evictFromRoom(g.id, rooms.conv(m.conversationId));
    }
    await db
      .update(socialAccounts)
      .set({ visibility: 'private' })
      .where(eq(socialAccounts.ownerUserId, g.id));
  }
  return expired.length;
}

export async function isGroupMember(convId: string, userId: string) {
  return Boolean(await membership(convId, userId));
}
