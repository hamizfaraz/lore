import {
  and,
  candidates,
  conversationMembers,
  desc,
  eq,
  eventCandidates,
  groupPlans,
  groupPreferences,
  isNull,
  planProposals,
  planRsvps,
  planVotes,
  recommendationTriggers,
  socialAccounts,
  user,
} from '@lore/db';
import type { GroupIntentBrief, PlanRanking } from '@lore/shared/ai';
import { uuidv7 } from '@lore/shared/ids';
import { getDb } from '../../lib/db';
import type { PlanCandidate, PlanContext, PlanPreference, StoredProposal, StoredVote } from './types';

export class PlansRepository {
  async membership(conversationId: string, userId: string) {
    const [row] = await getDb()
      .select({ role: conversationMembers.role })
      .from(conversationMembers)
      .where(
        and(
          eq(conversationMembers.conversationId, conversationId),
          eq(conversationMembers.userId, userId),
          isNull(conversationMembers.removedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async context(conversationId: string): Promise<PlanContext> {
    const [members, preferences] = await Promise.all([
      getDb()
        .select({ userId: conversationMembers.userId, displayName: user.name })
        .from(conversationMembers)
        .innerJoin(user, eq(user.id, conversationMembers.userId))
        .where(
          and(eq(conversationMembers.conversationId, conversationId), isNull(conversationMembers.removedAt)),
        ),
      getDb().select().from(groupPreferences).where(eq(groupPreferences.conversationId, conversationId)),
    ]);
    return { conversationId, members, preferences: preferences as PlanPreference[] };
  }

  async savePreference(
    conversationId: string,
    userId: string,
    input: Omit<PlanPreference, 'id' | 'userId'> & { proposalId?: string },
  ) {
    const [row] = await getDb()
      .insert(groupPreferences)
      .values({ id: uuidv7(), conversationId, userId, source: 'stated', ...input })
      .returning();
    return row!;
  }

  async createTrigger(conversationId: string, sourceMessageIds: string[] = []) {
    const [row] = await getDb()
      .insert(recommendationTriggers)
      .values({ id: uuidv7(), conversationId, kind: 'request', sourceMessageIds, confidence: 1 })
      .returning({ id: recommendationTriggers.id });
    return row!.id;
  }

  async saveCandidates(inputs: PlanCandidate[]): Promise<PlanCandidate[]> {
    const rows: PlanCandidate[] = [];
    for (const input of inputs) {
      const [row] = await getDb()
        .insert(candidates)
        .values({
          id: input.id,
          source: input.source,
          category: input.category,
          name: input.name,
          url: input.url,
          imageUrl: input.imageUrl,
          address: input.address,
          startsAt: input.startsAt,
          priceText: input.priceText,
          rating: input.rating,
          raw: { ...(input.raw ?? {}), priceAmount: input.priceAmount, travelMinutes: input.travelMinutes },
          lastVerifiedAt: input.lastVerifiedAt,
          dedupeKey: input.dedupeKey,
          embedding: input.embedding,
        })
        .onConflictDoUpdate({
          target: candidates.dedupeKey,
          set: {
            name: input.name,
            url: input.url,
            imageUrl: input.imageUrl,
            address: input.address,
            startsAt: input.startsAt,
            priceText: input.priceText,
            rating: input.rating,
            raw: { ...(input.raw ?? {}), priceAmount: input.priceAmount, travelMinutes: input.travelMinutes },
            lastVerifiedAt: input.lastVerifiedAt,
            embedding: input.embedding,
          },
        })
        .returning();
      const raw = (row!.raw ?? {}) as Record<string, unknown>;
      rows.push({
        ...row!,
        priceAmount: typeof raw.priceAmount === 'number' ? raw.priceAmount : null,
        travelMinutes: typeof raw.travelMinutes === 'number' ? raw.travelMinutes : null,
        raw,
      } as PlanCandidate);
    }
    return rows;
  }

  async createProposal(input: {
    conversationId: string;
    triggerId: string;
    userId: string;
    brief: GroupIntentBrief;
    options: PlanRanking & { degraded?: boolean };
  }): Promise<StoredProposal> {
    const [row] = await getDb()
      .insert(planProposals)
      .values({
        id: uuidv7(),
        conversationId: input.conversationId,
        triggerId: input.triggerId,
        brief: input.brief,
        options: input.options,
        createdBy: 'user',
        createdByUserId: input.userId,
        status: 'voting',
      })
      .returning();
    return row as StoredProposal;
  }

  async proposal(proposalId: string): Promise<StoredProposal | null> {
    const [row] = await getDb().select().from(planProposals).where(eq(planProposals.id, proposalId)).limit(1);
    return (row as StoredProposal | undefined) ?? null;
  }

  async proposals(conversationId: string): Promise<StoredProposal[]> {
    return (await getDb()
      .select()
      .from(planProposals)
      .where(eq(planProposals.conversationId, conversationId))
      .orderBy(desc(planProposals.createdAt))) as StoredProposal[];
  }

  async candidate(candidateId: string): Promise<PlanCandidate | null> {
    const [row] = await getDb().select().from(candidates).where(eq(candidates.id, candidateId)).limit(1);
    if (!row) return null;
    const raw = (row.raw ?? {}) as Record<string, unknown>;
    return {
      ...row,
      priceAmount: typeof raw.priceAmount === 'number' ? raw.priceAmount : null,
      travelMinutes: typeof raw.travelMinutes === 'number' ? raw.travelMinutes : null,
      raw,
    } as PlanCandidate;
  }

  async votes(proposalId: string, version: number): Promise<StoredVote[]> {
    return (await getDb()
      .select()
      .from(planVotes)
      .where(and(eq(planVotes.proposalId, proposalId), eq(planVotes.version, version)))) as StoredVote[];
  }

  async vote(input: StoredVote): Promise<void> {
    await getDb()
      .insert(planVotes)
      .values({ ...input, votedAt: new Date() })
      .onConflictDoUpdate({
        target: [planVotes.proposalId, planVotes.version, planVotes.userId, planVotes.candidateId],
        set: { response: input.response, votedAt: new Date() },
      });
  }

  async revise(proposalId: string, options: PlanRanking & { degraded?: boolean }): Promise<StoredProposal> {
    const current = await this.proposal(proposalId);
    const [row] = await getDb()
      .update(planProposals)
      .set({ version: (current?.version ?? 0) + 1, status: 'revised', options })
      .where(eq(planProposals.id, proposalId))
      .returning();
    return row as StoredProposal;
  }

  async dismiss(proposalId: string): Promise<void> {
    await getDb().update(planProposals).set({ status: 'dismissed' }).where(eq(planProposals.id, proposalId));
  }

  async confirm(input: {
    proposal: StoredProposal;
    candidate: PlanCandidate;
    userId: string;
    startsAt: Date;
    tz: string;
  }) {
    const planId = uuidv7();
    const [plan] = await getDb()
      .insert(groupPlans)
      .values({
        id: planId,
        proposalId: input.proposal.id,
        conversationId: input.proposal.conversationId,
        candidateId: input.candidate.id,
        title: input.candidate.name,
        startsAt: input.startsAt,
        tz: input.tz,
        regionLabel: input.candidate.address,
        confirmedByUserId: input.userId,
      })
      .returning();
    await getDb()
      .update(planProposals)
      .set({ status: 'confirmed' })
      .where(eq(planProposals.id, input.proposal.id));
    await getDb().insert(eventCandidates).values({
      id: uuidv7(),
      conversationId: input.proposal.conversationId,
      title: input.candidate.name,
      kind: 'outing',
      startsAt: input.startsAt,
      confidence: 1,
      sourceMessageIds: [],
      planId,
      state: 'confirmed',
    });
    await getDb()
      .insert(planRsvps)
      .values({ planId, userId: input.userId, status: 'going' })
      .onConflictDoNothing();
    return plan!;
  }

  async setRsvp(planId: string, userId: string, status: 'going' | 'maybe' | 'no') {
    await getDb()
      .insert(planRsvps)
      .values({ planId, userId, status })
      .onConflictDoUpdate({ target: [planRsvps.planId, planRsvps.userId], set: { status } });
  }

  async confirmedPlans(conversationId: string) {
    return getDb()
      .select({
        plan: groupPlans,
        candidate: candidates,
        confirmedByName: user.name,
      })
      .from(groupPlans)
      .innerJoin(candidates, eq(candidates.id, groupPlans.candidateId))
      .innerJoin(user, eq(user.id, groupPlans.confirmedByUserId))
      .where(eq(groupPlans.conversationId, conversationId))
      .orderBy(desc(groupPlans.createdAt));
  }

  async rsvps(planId: string) {
    return getDb().select().from(planRsvps).where(eq(planRsvps.planId, planId));
  }

  async plan(planId: string) {
    const [row] = await getDb()
      .select({ plan: groupPlans, candidate: candidates, confirmedByName: user.name })
      .from(groupPlans)
      .innerJoin(candidates, eq(candidates.id, groupPlans.candidateId))
      .innerJoin(user, eq(user.id, groupPlans.confirmedByUserId))
      .where(eq(groupPlans.id, planId))
      .limit(1);
    return row ?? null;
  }

  async groupAccountId(conversationId: string): Promise<string | null> {
    const [row] = await getDb()
      .select({ id: socialAccounts.id })
      .from(socialAccounts)
      .where(and(eq(socialAccounts.conversationId, conversationId), eq(socialAccounts.type, 'group')))
      .limit(1);
    return row?.id ?? null;
  }
}

export const plansRepository = new PlansRepository();
