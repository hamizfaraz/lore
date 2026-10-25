import {
  agentActionAudit,
  and,
  conversationMembers,
  conversations,
  desc,
  eq,
  eventCandidates,
  isNull,
  personalAccessTokens,
  podcastShows,
} from '@lore/db';
import type { TokenScope } from '@lore/shared/enums';
import { uuidv7 } from '@lore/shared/ids';
import { getDb } from '../../lib/db';
import type { AuditRecord, TokenRecord } from './types';

export class McpRepository {
  async createToken(userId: string, name: string, tokenHash: string, scopes: TokenScope[]) {
    const [row] = await getDb()
      .insert(personalAccessTokens)
      .values({ id: uuidv7(), userId, name, tokenHash, scopes })
      .returning();
    return row!;
  }

  async listTokens(userId: string) {
    return getDb()
      .select()
      .from(personalAccessTokens)
      .where(eq(personalAccessTokens.userId, userId))
      .orderBy(desc(personalAccessTokens.createdAt));
  }

  async revokeToken(userId: string, tokenId: string): Promise<boolean> {
    const rows = await getDb()
      .update(personalAccessTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(personalAccessTokens.id, tokenId), eq(personalAccessTokens.userId, userId)))
      .returning({ id: personalAccessTokens.id });
    return rows.length > 0;
  }

  async tokenByHash(tokenHash: string): Promise<TokenRecord | null> {
    const [row] = await getDb()
      .select({
        tokenId: personalAccessTokens.id,
        userId: personalAccessTokens.userId,
        scopes: personalAccessTokens.scopes,
        revokedAt: personalAccessTokens.revokedAt,
      })
      .from(personalAccessTokens)
      .where(eq(personalAccessTokens.tokenHash, tokenHash))
      .limit(1);
    if (!row || row.revokedAt) return null;
    await getDb()
      .update(personalAccessTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(personalAccessTokens.id, row.tokenId));
    return { ...row, scopes: row.scopes as TokenScope[] };
  }

  async audit(record: AuditRecord): Promise<void> {
    await getDb()
      .insert(agentActionAudit)
      .values({ id: uuidv7(), ...record });
  }

  async groups(userId: string) {
    return getDb()
      .select({
        id: conversations.id,
        title: conversations.title,
        kind: conversations.kind,
        groupAccountId: conversations.groupAccountId,
      })
      .from(conversationMembers)
      .innerJoin(conversations, eq(conversations.id, conversationMembers.conversationId))
      .where(and(eq(conversationMembers.userId, userId), isNull(conversationMembers.removedAt)))
      .orderBy(desc(conversations.lastMessageAt));
  }

  async events(userId: string, conversationId?: string) {
    const membership = and(
      eq(conversationMembers.userId, userId),
      isNull(conversationMembers.removedAt),
      conversationId ? eq(eventCandidates.conversationId, conversationId) : undefined,
    );
    return getDb()
      .select({
        id: eventCandidates.id,
        conversationId: eventCandidates.conversationId,
        title: eventCandidates.title,
        kind: eventCandidates.kind,
        startsAt: eventCandidates.startsAt,
        endsAt: eventCandidates.endsAt,
        state: eventCandidates.state,
        planId: eventCandidates.planId,
      })
      .from(eventCandidates)
      .innerJoin(conversationMembers, eq(conversationMembers.conversationId, eventCandidates.conversationId))
      .where(membership)
      .orderBy(desc(eventCandidates.startsAt));
  }

  async podcastStatus(userId: string, conversationId: string) {
    return getDb()
      .select({
        id: podcastShows.id,
        conversationId: podcastShows.conversationId,
        title: podcastShows.title,
        state: podcastShows.state,
        requiredParticipantIds: podcastShows.requiredParticipantIds,
        wrappedAt: podcastShows.wrappedAt,
        renderMediaId: podcastShows.renderMediaId,
        createdAt: podcastShows.createdAt,
      })
      .from(podcastShows)
      .innerJoin(conversationMembers, eq(conversationMembers.conversationId, podcastShows.conversationId))
      .where(
        and(
          eq(podcastShows.conversationId, conversationId),
          eq(conversationMembers.userId, userId),
          isNull(conversationMembers.removedAt),
        ),
      )
      .orderBy(desc(podcastShows.createdAt));
  }
}

export const mcpRepository = new McpRepository();
