import { createHash } from 'node:crypto';
import {
  CONCIERGE_SYSTEM_PROMPT,
  SerpClient,
  callStructured,
  embedTexts,
  sanitizePlanRanking,
} from '@lore/ai';
import { GroupIntentBrief, PlanRanking, type PlanRanking as PlanRankingType } from '@lore/shared/ai';
import type {
  PlanCardDTO,
  PlanConfirmedCardDTO,
  PlansOverviewDTO,
  PreferenceDTO,
  SuggestResult,
} from '@lore/shared/dto/plans';
import type { PreferenceBody, RefineBody, SuggestBody, VoteBody } from '@lore/shared/dto/plans';
import type { Category } from '@lore/shared/enums';
import { uuidv7 } from '@lore/shared/ids';
import { type Actor, actorUserId, userActor } from '../../lib/actor';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors';
import { getRedis } from '../../lib/redis';
import { postMessage } from '../chat/service';
import { recordImpactEvent } from '../impact/service';
import { emitPlanUpdated } from './events';
import {
  applyHardConstraints,
  candidatePriceUnverified,
  ensureAtHomeOption,
  maximinDiverse,
  preferenceSummary,
  validCandidate,
} from './policy';
import { PlansRepository, plansRepository } from './repository';
import type { PlanCandidate, PlanContext, StoredProposal } from './types';

type SearchResult = Awaited<ReturnType<SerpClient['events']>>;
type PlanStore = Pick<
  PlansRepository,
  | 'membership'
  | 'context'
  | 'savePreference'
  | 'createTrigger'
  | 'saveCandidates'
  | 'createProposal'
  | 'proposal'
  | 'proposals'
  | 'candidate'
  | 'votes'
  | 'vote'
  | 'revise'
  | 'dismiss'
  | 'confirm'
  | 'setRsvp'
  | 'confirmedPlans'
  | 'rsvps'
  | 'plan'
>;

export type PlansDependencies = {
  store: PlanStore;
  now: () => Date;
  makeBrief: (
    context: PlanContext,
    request: string,
  ) => Promise<{ data: GroupIntentBrief; degraded: boolean }>;
  search: (query: GroupIntentBrief['searchQueries'][number]) => Promise<SearchResult>;
  embed: (values: string[]) => Promise<number[][]>;
  rank: (
    brief: GroupIntentBrief,
    candidates: PlanCandidate[],
    context: PlanContext,
  ) => Promise<{ data: PlanRankingType; degraded: boolean }>;
  post: typeof postMessage;
  emit: typeof emitPlanUpdated;
  impact?: typeof recordImpactEvent;
};

function stableKey(value: string): string {
  return createHash('sha256').update(value.trim().toLocaleLowerCase()).digest('hex');
}

function seededCandidate(
  name: string,
  category: Category,
  extra: Partial<PlanCandidate> = {},
): PlanCandidate {
  return {
    id: uuidv7(),
    source: 'seed',
    category,
    name,
    url: null,
    imageUrl: null,
    address: category === 'at_home' || category === 'online' ? null : 'Nearby',
    startsAt: null,
    priceText: '$0–15',
    priceAmount: 15,
    travelMinutes: category === 'at_home' || category === 'online' ? 0 : 15,
    rating: null,
    lastVerifiedAt: new Date(),
    dedupeKey: stableKey(`${category}:${name}`),
    raw: { seededFallback: true },
    ...extra,
  };
}

export function fallbackCandidates(): PlanCandidate[] {
  return [
    seededCandidate('Neighborhood picnic and sunset walk', 'place', {
      url: 'https://www.google.com/maps/search/?api=1&query=public+park',
      priceText: 'Free',
      priceAmount: 0,
    }),
    seededCandidate('Cozy watch party and board games', 'at_home', {
      priceText: '$0–10',
      priceAmount: 10,
    }),
    seededCandidate('Online co-op game night', 'online', {
      url: 'https://en.wikipedia.org/wiki/Cooperative_video_game',
      priceText: 'Free options',
      priceAmount: 0,
    }),
  ];
}

function preferenceConstraints(context: PlanContext): GroupIntentBrief['hardConstraints'] {
  return context.preferences
    .filter((preference) =>
      ['budget_max', 'region', 'travel_minutes', 'time_windows', 'dietary', 'accessibility'].includes(
        preference.key,
      ),
    )
    .map(({ userId, key, value }) => ({ userId, key, value }));
}

function mockBrief(context: PlanContext, request: string): GroupIntentBrief {
  return {
    goal: request.trim() || 'spend time together',
    whenText: 'This weekend',
    mode: 'either',
    categories: ['place', 'event', 'at_home', 'online'],
    hardConstraints: preferenceConstraints(context),
    softPreferences: context.members.map((member) => {
      const likes = context.preferences
        .filter((preference) => preference.userId === member.userId && preference.key === 'likes')
        .flatMap((preference) => (Array.isArray(preference.value) ? preference.value.map(String) : []));
      const dislikes = context.preferences
        .filter((preference) => preference.userId === member.userId && preference.key === 'dislikes')
        .flatMap((preference) => (Array.isArray(preference.value) ? preference.value.map(String) : []));
      return { userId: member.userId, likes, dislikes };
    }),
    unknowns: request.trim()
      ? []
      : [{ key: 'budget_max', question: 'What is the most each person wants to spend?' }],
    searchQueries: request.trim()
      ? [
          { engine: 'events', q: `${request.trim()} this weekend` },
          { engine: 'maps', q: `${request.trim()} nearby` },
        ]
      : [],
  };
}

function mockRanking(candidates: PlanCandidate[], context: PlanContext): PlanRankingType {
  return {
    options: candidates.slice(0, 4).map((candidate) => ({
      candidateId: candidate.id,
      headline: candidate.name,
      why:
        candidate.category === 'at_home' || candidate.category === 'online'
          ? 'keeps cost and travel low while everyone can join'
          : 'a sourced nearby option that balances the group’s constraints',
      fitByMember: context.members.map((member) => ({
        userId: member.userId,
        fit: candidate.category === 'at_home' ? 'great' : 'ok',
        note: candidate.category === 'at_home' ? 'easy, low-cost option' : 'fits the shared request',
      })),
      logistics: {
        ...(candidate.priceText ? { priceText: candidate.priceText } : {}),
        ...(candidate.startsAt ? { whenText: candidate.startsAt.toISOString() } : { whenText: 'Flexible' }),
        ...(candidate.travelMinutes !== null
          ? {
              travelText:
                candidate.travelMinutes === 0 ? 'At home / online' : `${candidate.travelMinutes} min`,
            }
          : {}),
      },
    })),
    compromiseNote: 'Options are ordered by the least-happy member’s fit, then overall fit.',
    noFeasibleOption: candidates.length === 0,
    ...(candidates.length === 0
      ? { askToRelax: 'Could the group relax one budget, travel, or time limit?' }
      : {}),
  };
}

const serp = () => new SerpClient(getRedis());
const defaultDependencies: PlansDependencies = {
  store: plansRepository,
  now: () => new Date(),
  makeBrief: async (context, request) => {
    const result = await callStructured(
      GroupIntentBrief,
      [
        { role: 'system', content: CONCIERGE_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `REQUEST\n${request || 'No request supplied'}\nMEMBERS\n${context.members.map((m) => m.userId).join('\n')}\nPREFERENCES\n${JSON.stringify(context.preferences)}`,
        },
      ],
      { name: 'groupIntentBrief', mockValue: mockBrief(context, request), timeoutMs: 8_000 },
    );
    return { data: result.data, degraded: result.degraded };
  },
  search: (query) => {
    const client = serp();
    if (query.engine === 'events') return client.events({ q: query.q });
    if (query.engine === 'maps') return client.places({ q: query.q });
    if (query.engine === 'news') return client.news({ q: query.q });
    return client.mediaLookup({ q: query.q });
  },
  embed: embedTexts,
  rank: async (brief, candidates, context) => {
    const result = await callStructured(
      PlanRanking,
      [
        { role: 'system', content: CONCIERGE_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `BRIEF\n${JSON.stringify(brief)}\nCANDIDATES\n${JSON.stringify(candidates)}`,
        },
      ],
      { name: 'planRanking', mockValue: mockRanking(candidates, context), timeoutMs: 8_000 },
    );
    return { data: result.data, degraded: result.degraded };
  },
  post: postMessage,
  emit: emitPlanUpdated,
  impact: recordImpactEvent,
};

function sourceRows(result: SearchResult): Record<string, unknown>[] {
  const keys = ['events_results', 'local_results', 'organic_results', 'news_results'];
  return keys.flatMap((key) => {
    const rows = result.raw[key];
    return Array.isArray(rows)
      ? rows.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object'))
      : [];
  });
}

function categoryFor(engine: SearchResult['engine']): Category {
  if (engine === 'google_events') return 'event';
  if (engine === 'google_maps') return 'place';
  if (engine === 'google_news') return 'event';
  return 'online';
}

function normalizeSearch(result: SearchResult, now: Date): PlanCandidate[] {
  return sourceRows(result).map((row) => {
    const name = String(row.title ?? row.name ?? 'Untitled option');
    const url =
      typeof row.link === 'string' ? row.link : typeof row.website === 'string' ? row.website : null;
    const priceText = typeof row.price === 'string' ? row.price : null;
    const priceMatch = priceText?.match(/[0-9]+(?:\.[0-9]+)?/);
    const source =
      result.engine === 'google_events'
        ? 'serp_events'
        : result.engine === 'google_maps'
          ? 'serp_maps'
          : result.engine === 'google_news'
            ? 'serp_news'
            : 'serp_kg';
    return {
      id: uuidv7(),
      source,
      category: categoryFor(result.engine),
      name,
      url,
      imageUrl: typeof row.thumbnail === 'string' ? row.thumbnail : null,
      address: typeof row.address === 'string' ? row.address : null,
      startsAt: typeof row.start_time === 'string' ? new Date(row.start_time) : null,
      priceText,
      priceAmount: priceMatch ? Number(priceMatch[0]) : null,
      travelMinutes: typeof row.travel_minutes === 'number' ? row.travel_minutes : null,
      rating: typeof row.rating === 'number' ? row.rating : null,
      lastVerifiedAt: new Date(result.fetchedAt || now),
      dedupeKey: stableKey(`${name}:${url ?? ''}`),
      raw: row,
    } satisfies PlanCandidate;
  });
}

function tally(votes: Awaited<ReturnType<PlanStore['votes']>>, candidateId: string) {
  const counts = { yes: 0, flexible: 0, no: 0, veto: 0 };
  for (const vote of votes) if (vote.candidateId === candidateId) counts[vote.response] += 1;
  return counts;
}

export class PlansService {
  constructor(private readonly deps: PlansDependencies = defaultDependencies) {}

  private async requireMember(conversationId: string, userId: string) {
    const membership = await this.deps.store.membership(conversationId, userId);
    if (!membership) throw forbidden('Conversation membership required');
    return membership;
  }

  private async card(proposal: StoredProposal, userId: string): Promise<PlanCardDTO> {
    const [votes, context] = await Promise.all([
      this.deps.store.votes(proposal.id, proposal.version),
      this.deps.store.context(proposal.conversationId),
    ]);
    const candidateRows = await Promise.all(
      proposal.options.options.map((option) => this.deps.store.candidate(option.candidateId)),
    );
    const byId = new Map(candidateRows.filter(Boolean).map((candidate) => [candidate!.id, candidate!]));
    return {
      id: proposal.id,
      conversationId: proposal.conversationId,
      version: proposal.version,
      status: proposal.status,
      header: proposal.options.noFeasibleOption
        ? 'No option fits every hard limit yet'
        : 'Three fair ways to get together',
      evidence: preferenceSummary(context.preferences),
      options: proposal.options.options.flatMap((option) => {
        const candidate = byId.get(option.candidateId);
        if (!candidate) return [];
        return [
          {
            candidateId: candidate.id,
            name: candidate.name,
            category: candidate.category,
            headline: option.headline,
            why: option.why,
            imageUrl: candidate.imageUrl,
            sourceUrl: candidate.url,
            sourceDomain: candidate.url ? new URL(candidate.url).hostname.replace(/^www\./, '') : null,
            lastVerifiedAt: candidate.lastVerifiedAt?.toISOString() ?? null,
            priceText: option.logistics.priceText ?? candidate.priceText,
            priceUnverified: candidatePriceUnverified(candidate),
            whenText: option.logistics.whenText ?? null,
            travelText: option.logistics.travelText ?? null,
            fitByMember: option.fitByMember.map(({ userId: fitUserId, fit }) => ({ userId: fitUserId, fit })),
            tally: tally(votes, candidate.id),
            myResponse:
              votes.find((vote) => vote.userId === userId && vote.candidateId === candidate.id)?.response ??
              null,
          },
        ];
      }),
      compromiseNote: proposal.options.compromiseNote ?? null,
      noFeasibleOption: proposal.options.noFeasibleOption,
      askToRelax: proposal.options.askToRelax ?? null,
      decorativeImageUrl: null,
      degraded: proposal.options.degraded ?? false,
      createdBy: proposal.createdBy,
    };
  }

  private async confirmedCard(
    row: Awaited<ReturnType<PlanStore['confirmedPlans']>>[number],
  ): Promise<PlanConfirmedCardDTO> {
    const rsvps = await this.deps.store.rsvps(row.plan.id);
    return {
      planId: row.plan.id,
      proposalId: row.plan.proposalId,
      title: row.plan.title,
      startsAt: row.plan.startsAt.toISOString(),
      tz: row.plan.tz,
      placeUrl: row.candidate.url,
      regionLabel: row.plan.regionLabel,
      confirmedBy: { userId: row.plan.confirmedByUserId, displayName: row.confirmedByName },
      rsvps: rsvps.map((rsvp) => ({ userId: rsvp.userId, status: rsvp.status })),
      icsUrl: `/v1/group-plans/${row.plan.id}/calendar.ics`,
    };
  }

  async list(conversationId: string, userId: string): Promise<PlansOverviewDTO> {
    await this.requireMember(conversationId, userId);
    const [proposals, confirmed, context] = await Promise.all([
      this.deps.store.proposals(conversationId),
      this.deps.store.confirmedPlans(conversationId),
      this.deps.store.context(conversationId),
    ]);
    return {
      proposals: await Promise.all(proposals.map((proposal) => this.card(proposal, userId))),
      confirmed: await Promise.all(confirmed.map((row) => this.confirmedCard(row))),
      preferences: context.preferences.map((preference, index) => ({
        id: preference.id ?? `${conversationId}:${index}`,
        conversationId,
        userId: preference.userId,
        proposalId: undefined,
        key: preference.key,
        value: preference.value,
        visibility: preference.visibility,
        createdAt: this.deps.now().toISOString(),
      })),
    };
  }

  async savePreference(conversationId: string, userId: string, body: PreferenceBody): Promise<PreferenceDTO> {
    await this.requireMember(conversationId, userId);
    const row = await this.deps.store.savePreference(conversationId, userId, body);
    return {
      ...row,
      proposalId: row.proposalId ?? undefined,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async suggest(conversationId: string, userId: string, body: SuggestBody): Promise<SuggestResult> {
    await this.requireMember(conversationId, userId);
    const context = await this.deps.store.context(conversationId);
    const briefResult = await this.deps.makeBrief(context, body.request ?? '');
    const brief = {
      ...briefResult.data,
      searchQueries: briefResult.data.searchQueries.slice(0, 4),
      unknowns: briefResult.data.unknowns.slice(0, 1),
    };
    const triggerId = await this.deps.store.createTrigger(conversationId);
    if (brief.unknowns[0]) {
      const proposal = await this.deps.store.createProposal({
        conversationId,
        triggerId,
        userId,
        brief,
        options: {
          options: [],
          noFeasibleOption: true,
          askToRelax: brief.unknowns[0].question,
          degraded: briefResult.degraded,
        },
      });
      return {
        plan: await this.card(proposal, userId),
        question: {
          key: brief.unknowns[0].key,
          prompt: brief.unknowns[0].question,
          replies: ['$15', '$30', '$60', 'Flexible'],
        },
      };
    }

    const searchResults = await Promise.all(brief.searchQueries.map((query) => this.deps.search(query)));
    const fallbacks = fallbackCandidates();
    let candidateRows = searchResults
      .flatMap((result) => normalizeSearch(result, this.deps.now()))
      .filter(validCandidate);
    if (candidateRows.length < 3) candidateRows = [...candidateRows, ...fallbacks].filter(validCandidate);
    candidateRows = ensureAtHomeOption(candidateRows, fallbacks[1]!);
    candidateRows = applyHardConstraints(candidateRows, brief.hardConstraints);
    const unique = [
      ...new Map(candidateRows.map((candidate) => [candidate.dedupeKey, candidate])).values(),
    ].slice(0, 12);
    const vectors = unique.length
      ? await this.deps.embed(unique.map((candidate) => `${candidate.name} ${candidate.category}`))
      : [];
    const stored = await this.deps.store.saveCandidates(
      unique.map((candidate, index) => ({ ...candidate, embedding: vectors[index] })),
    );
    const rankingResult = await this.deps.rank(brief, stored, context);
    const sanitized = sanitizePlanRanking(rankingResult.data, {
      candidateIds: stored.map((candidate) => candidate.id),
      userIds: context.members.map((member) => member.userId),
    });
    const rankedOptions = maximinDiverse(sanitized, stored, 3);
    const options = {
      ...sanitized,
      options: rankedOptions,
      noFeasibleOption: rankedOptions.length === 0,
      ...(rankedOptions.length === 0 ? { askToRelax: 'Could the group relax one hard constraint?' } : {}),
      degraded:
        briefResult.degraded || rankingResult.degraded || searchResults.some((result) => result.degraded),
    };
    const proposal = await this.deps.store.createProposal({
      conversationId,
      triggerId,
      userId,
      brief,
      options,
    });
    await this.deps
      .impact?.({
        kind: 'plan_suggested',
        groupId: conversationId,
        actorId: userId,
        objectId: proposal.id,
        props: { candidateCount: rankedOptions.length },
      })
      .catch(() => undefined);
    const plan = await this.card(proposal, userId);
    await this.deps
      .post(
        conversationId,
        {
          kind: 'card',
          cardKind: 'plan_card',
          cardRefId: proposal.id,
          clientId: `plan:${proposal.id}:v${proposal.version}`,
          meta: { degraded: plan.degraded },
        },
        userActor(userId),
      )
      .catch(() => null);
    this.deps.emit(plan);
    return { plan, question: null };
  }

  private async memberProposal(proposalId: string, userId: string) {
    const proposal = await this.deps.store.proposal(proposalId);
    if (!proposal) throw notFound('Plan proposal not found');
    await this.requireMember(proposal.conversationId, userId);
    return proposal;
  }

  async vote(proposalId: string, actor: Actor, body: VoteBody): Promise<PlanCardDTO> {
    const userId = actorUserId(actor);
    if (!userId) throw forbidden('A human or authorized agent identity is required');
    const proposal = await this.memberProposal(proposalId, userId);
    if (proposal.status === 'confirmed' || proposal.status === 'dismissed')
      throw conflict('This proposal is closed');
    if (!proposal.options.options.some((option) => option.candidateId === body.candidateId)) {
      throw badRequest('Candidate is not part of the current proposal version');
    }
    await this.deps.store.vote({ proposalId, version: proposal.version, userId, ...body });
    await this.deps
      .impact?.({
        kind: 'plan_vote_cast',
        groupId: proposal.conversationId,
        actorId: userId,
        objectId: proposal.id,
        props: { response: body.response },
      })
      .catch(() => undefined);
    const card = await this.card(proposal, userId);
    this.deps.emit(card);
    return card;
  }

  async refine(proposalId: string, userId: string, body: RefineBody): Promise<PlanCardDTO> {
    const proposal = await this.memberProposal(proposalId, userId);
    const next = await this.deps.store.revise(proposalId, {
      ...proposal.options,
      options: [...proposal.options.options].reverse().map((option) => ({
        ...option,
        why: `${option.why} Refined for: ${body.instruction}`.slice(0, 280),
      })),
      compromiseNote: `Refined without changing the group’s hard constraints: ${body.instruction}`,
    });
    const card = await this.card(next, userId);
    this.deps.emit(card);
    return card;
  }

  async dismiss(proposalId: string, userId: string): Promise<void> {
    await this.memberProposal(proposalId, userId);
    await this.deps.store.dismiss(proposalId);
  }

  async confirm(
    proposalId: string,
    userId: string,
    body: { candidateId: string; startsAt: string; tz: string },
  ): Promise<PlanConfirmedCardDTO> {
    const proposal = await this.memberProposal(proposalId, userId);
    if (proposal.status === 'confirmed') throw conflict('Plan is already confirmed');
    if (!proposal.options.options.some((option) => option.candidateId === body.candidateId)) {
      throw badRequest('Candidate is not part of the current proposal version');
    }
    const startsAt = new Date(body.startsAt);
    if (!Number.isFinite(startsAt.getTime())) throw badRequest('startsAt must be a valid date');
    const candidate = await this.deps.store.candidate(body.candidateId);
    if (!candidate) throw notFound('Candidate not found');
    const plan = await this.deps.store.confirm({ proposal, candidate, userId, startsAt, tz: body.tz });
    const votes = await this.deps.store.votes(proposal.id, proposal.version);
    await this.deps
      .impact?.({
        kind: 'plan_confirmed',
        groupId: proposal.conversationId,
        actorId: userId,
        objectId: proposal.id,
        props: {
          voteCount: votes.length,
          intentToConfirmMs: Math.max(0, this.deps.now().getTime() - proposal.createdAt.getTime()),
        },
      })
      .catch(() => undefined);
    const row = await this.deps.store.plan(plan.id);
    if (!row) throw notFound('Confirmed plan not found');
    const card = await this.confirmedCard(row as Awaited<ReturnType<PlanStore['confirmedPlans']>>[number]);
    await this.deps
      .post(
        proposal.conversationId,
        {
          kind: 'card',
          cardKind: 'plan_confirmed',
          cardRefId: card.planId,
          clientId: `plan-confirmed:${card.planId}`,
          body: card.title,
        },
        userActor(userId),
      )
      .catch(() => null);
    return card;
  }

  async resolveCard(proposalId: string, userId: string): Promise<PlanCardDTO | undefined> {
    const proposal = await this.deps.store.proposal(proposalId);
    if (!proposal) return undefined;
    await this.requireMember(proposal.conversationId, userId);
    return this.card(proposal, userId);
  }

  async resolveConfirmed(planId: string, userId: string): Promise<PlanConfirmedCardDTO | undefined> {
    const row = await this.deps.store.plan(planId);
    if (!row) return undefined;
    await this.requireMember(row.plan.conversationId, userId);
    return this.confirmedCard(row as Awaited<ReturnType<PlanStore['confirmedPlans']>>[number]);
  }

  async rsvp(planId: string, userId: string, status: 'going' | 'maybe' | 'no') {
    const row = await this.deps.store.plan(planId);
    if (!row) throw notFound('Plan not found');
    await this.requireMember(row.plan.conversationId, userId);
    await this.deps.store.setRsvp(planId, userId, status);
    const refreshed = await this.deps.store.plan(planId);
    return this.confirmedCard(refreshed as Awaited<ReturnType<PlanStore['confirmedPlans']>>[number]);
  }

  async calendar(planId: string, userId: string): Promise<string> {
    const row = await this.deps.store.plan(planId);
    if (!row) throw notFound('Plan not found');
    await this.requireMember(row.plan.conversationId, userId);
    const escapeIcs = (value: string) => value.replace(/[\\;,\n]/g, (match) => `\\${match}`);
    const stamp = row.plan.startsAt
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//LORE//Group Plan//EN',
      'BEGIN:VEVENT',
      `UID:${row.plan.id}@ourlore.tech`,
      `DTSTART:${stamp}`,
      `SUMMARY:${escapeIcs(row.plan.title)}`,
      ...(row.candidate.url ? [`URL:${row.candidate.url}`] : []),
      ...(row.plan.regionLabel ? [`LOCATION:${escapeIcs(row.plan.regionLabel)}`] : []),
      'END:VEVENT',
      'END:VCALENDAR',
      '',
    ].join('\r\n');
  }
}

export const plansService = new PlansService();
export const listPlans = plansService.list.bind(plansService);
export const savePreference = plansService.savePreference.bind(plansService);
export const suggestPlans = plansService.suggest.bind(plansService);
export const voteOnPlan = plansService.vote.bind(plansService);
export const refinePlan = plansService.refine.bind(plansService);
export const dismissPlan = plansService.dismiss.bind(plansService);
export const confirmPlan = plansService.confirm.bind(plansService);
export const rsvpPlan = plansService.rsvp.bind(plansService);
export const planCalendar = plansService.calendar.bind(plansService);
export const resolvePlanCard = (proposalId: string, userId: string) =>
  plansService.resolveCard(proposalId, userId);
export const resolveConfirmedPlanCard = (planId: string, userId: string) =>
  plansService.resolveConfirmed(planId, userId);
