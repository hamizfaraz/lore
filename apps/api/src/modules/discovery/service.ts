import { DISCOVERY_SYSTEM_PROMPT, callStructured, embedTexts } from '@lore/ai';
import { CommonGroundReason } from '@lore/shared/ai';
import type {
  CommonGroundCardDTO,
  DiscoveryOverviewDTO,
  DiscoveryProfileBody,
  DiscoveryProfileDTO,
  IntroductionDTO,
  QuizAnswersBody,
} from '@lore/shared/dto/discovery';
import { z } from 'zod';
import { badRequest, forbidden, notFound } from '../../lib/errors';
import { getRedis } from '../../lib/redis';
import { recordImpactEvent } from '../impact/service';
import { decayTouched, matchScore, safeTags, visibleInferred } from './policy';
import { discoveryRepository, type DiscoveryRepository } from './repository';
import type { DiscoveryCandidate, StoredInterestProfile, StoredIntroduction } from './types';

export type SignalKind = 'like' | 'save' | 'share' | 'follow' | 'graph';
const SIGNAL_WEIGHT: Record<SignalKind, number> = {
  like: 0.35,
  save: 0.55,
  share: 0.65,
  follow: 0.45,
  graph: 0.25,
};
const EMPTY_PROFILE = (userId: string): StoredInterestProfile => ({
  userId,
  explicitTags: [],
  inferred: {},
  inferredTouched: {},
  graphTags: [],
  frozen: false,
  discoverable: false,
  bioSnippet: null,
  embedding: null,
  updatedAt: new Date(0),
});

type Cache = {
  get(key: string): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<unknown>;
};
export type DiscoveryDependencies = {
  store: DiscoveryRepository;
  embed: typeof embedTexts;
  cache: () => Cache;
  now: () => Date;
  impact?: typeof recordImpactEvent;
  openDirect?: (fromUserId: string, toUserId: string, firstMessage: string | null) => Promise<string>;
};

function profileTags(profile: StoredInterestProfile) {
  return safeTags([...profile.explicitTags, ...visibleInferred(profile.inferred).map(({ tag }) => tag)]);
}

function profileDTO(profile: StoredInterestProfile | null, userId: string): DiscoveryProfileDTO {
  const value = profile ?? EMPTY_PROFILE(userId);
  return {
    explicitTags: value.explicitTags,
    inferredTags: visibleInferred(value.inferred),
    removedTags: Object.entries(value.inferred)
      .filter(([, score]) => score < 0)
      .map(([tag]) => tag),
    frozen: value.frozen,
    discoverable: value.discoverable,
    bioSnippet: value.bioSnippet,
    updatedAt: profile ? value.updatedAt.toISOString() : null,
  };
}

function defaultReason(sharedTags: string[]) {
  const label = sharedTags.slice(0, 2).join(' and ') || 'trying something new';
  return {
    sharedTags,
    reason: `You both chose ${label} as a public interest.`,
    starter: `What do you enjoy most about ${sharedTags[0] ?? 'your latest hobby'}?`,
    activityIdea: sharedTags[0] ? `Try a low-key ${sharedTags[0]} meetup` : undefined,
  };
}

export class DiscoveryService {
  constructor(private readonly deps: DiscoveryDependencies) {}

  private async stored(userId: string) {
    return (await this.deps.store.profile(userId)) ?? EMPTY_PROFILE(userId);
  }

  private async embed(profile: Pick<StoredInterestProfile, 'explicitTags' | 'inferred' | 'bioSnippet'>) {
    const text = [
      ...profile.explicitTags,
      ...visibleInferred(profile.inferred).map(({ tag }) => tag),
      profile.bioSnippet ?? '',
    ]
      .filter(Boolean)
      .join(', ');
    return text ? ((await this.deps.embed([text]))[0] ?? null) : null;
  }

  async profile(userId: string) {
    return profileDTO(await this.deps.store.profile(userId), userId);
  }

  async updateProfile(userId: string, body: DiscoveryProfileBody) {
    const current = await this.stored(userId);
    const removed = safeTags(body.removedTags ?? []);
    const explicitTags = safeTags(body.explicitTags ?? current.explicitTags).filter(
      (tag) => !removed.includes(tag),
    );
    const inferred = { ...current.inferred };
    const inferredTouched = { ...current.inferredTouched };
    for (const tag of removed) {
      inferred[tag] = -1;
      delete inferredTouched[tag];
    }
    for (const tag of explicitTags) if (inferred[tag]! < 0) delete inferred[tag];
    const next = {
      ...current,
      explicitTags,
      inferred,
      inferredTouched,
      frozen: body.frozen ?? current.frozen,
      discoverable: body.discoverable ?? current.discoverable,
      bioSnippet: body.bioSnippet === undefined ? current.bioSnippet : body.bioSnippet,
    };
    const saved = await this.deps.store.saveProfile({ ...next, embedding: await this.embed(next) });
    return profileDTO(saved, userId);
  }

  async saveQuiz(userId: string, input: QuizAnswersBody) {
    await this.deps.store.saveQuiz(userId, input.answers);
    const selected = input.answers.flatMap(({ answer }) =>
      typeof answer === 'string'
        ? [answer]
        : Array.isArray(answer)
          ? answer.filter((v): v is string => typeof v === 'string')
          : [],
    );
    const current = await this.stored(userId);
    return this.updateProfile(userId, { explicitTags: safeTags([...current.explicitTags, ...selected]) });
  }

  async recordSignal(userId: string, tags: string[], kind: SignalKind) {
    const current = await this.stored(userId);
    // Freeze blocks passive inference changes, but an explicit Facebook disconnect must revoke
    // previously imported Graph suggestions immediately.
    if (current.frozen && !(kind === 'graph' && tags.length === 0)) return profileDTO(current, userId);
    const decayed = decayTouched(
      current.inferred,
      current.inferredTouched ?? {},
      current.updatedAt,
      this.deps.now(),
    );
    const inferred = decayed.inferred;
    const inferredTouched = decayed.touched;
    const nextTags = safeTags(tags, 3);
    let explicitTags = current.explicitTags;
    if (kind === 'graph') {
      for (const tag of current.graphTags ?? []) {
        delete inferred[tag];
        delete inferredTouched[tag];
      }
      explicitTags = explicitTags.filter((tag) => !(current.graphTags ?? []).includes(tag));
    }
    for (const tag of nextTags) {
      if (inferred[tag]! < 0 || current.explicitTags.includes(tag)) continue;
      inferred[tag] = Math.min(1, (inferred[tag] ?? 0) + SIGNAL_WEIGHT[kind]);
      inferredTouched[tag] = this.deps.now().toISOString();
    }
    const next = {
      ...current,
      inferred,
      inferredTouched,
      explicitTags,
      graphTags: kind === 'graph' ? nextTags : current.graphTags,
    };
    const saved = await this.deps.store.saveProfile({ ...next, embedding: await this.embed(next) });
    return profileDTO(saved, userId);
  }

  /** Explicit revocation path; legacyTags cleans profiles created before graphTags was tracked. */
  async clearGraphSignals(userId: string, legacyTags: string[] = []) {
    const current = await this.stored(userId);
    const drop = new Set(safeTags([...(current.graphTags ?? []), ...legacyTags]));
    const inferred = { ...current.inferred };
    const inferredTouched = { ...current.inferredTouched };
    for (const tag of drop) {
      delete inferred[tag];
      delete inferredTouched[tag];
    }
    const next = {
      ...current,
      explicitTags: current.explicitTags.filter((tag) => !drop.has(tag)),
      inferred,
      inferredTouched,
      graphTags: [],
    };
    const saved = await this.deps.store.saveProfile({ ...next, embedding: await this.embed(next) });
    return profileDTO(saved, userId);
  }

  private async reason(userId: string, candidate: DiscoveryCandidate, sharedTags: string[]) {
    const key = `discovery:reason:${[userId, candidate.userId].sort().join(':')}:${sharedTags.join(',')}`;
    const cache = this.deps.cache();
    const cached = await cache.get(key).catch(() => null);
    if (cached) return CommonGroundReason.parse(JSON.parse(cached));
    const fallback = defaultReason(sharedTags);
    const result = await callStructured(
      CommonGroundReason,
      [
        { role: 'system', content: DISCOVERY_SYSTEM_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            permittedSharedTags: sharedTags,
            publicBioSnippet: candidate.bioSnippet,
          }),
        },
      ],
      { name: 'commonGroundReason', mockValue: fallback, maxOutputTokens: 220 },
    );
    const clean = {
      ...result.data,
      sharedTags: safeTags(result.data.sharedTags).filter((tag) => sharedTags.includes(tag)),
    };
    if (!clean.sharedTags.length) clean.sharedTags = sharedTags;
    await cache.setex(key, 86_400, JSON.stringify(clean)).catch(() => undefined);
    return clean;
  }

  async matches(userId: string): Promise<CommonGroundCardDTO[]> {
    const current = await this.stored(userId);
    if (!current.discoverable) return [];
    const [candidates, connected, blocked] = await Promise.all([
      this.deps.store.candidates(userId),
      this.deps.store.connectedUserIds(userId),
      this.deps.store.blockedUserIds(userId),
    ]);
    const ownTags = profileTags(current);
    const ranked = candidates
      .filter((candidate) => !connected.has(candidate.userId) && !blocked.has(candidate.userId))
      .map((candidate) => ({
        candidate,
        ...matchScore(ownTags, profileTags(candidate), [current.embedding, candidate.embedding]),
      }))
      .filter(({ shared }) => shared.length > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);
    return Promise.all(
      ranked.map(async ({ candidate, shared, score }) => {
        const grounded = await this.reason(userId, candidate, shared);
        return {
          userId: candidate.userId,
          account: candidate.account,
          bioSnippet: candidate.bioSnippet,
          sharedTags: grounded.sharedTags,
          reason: grounded.reason,
          starter: grounded.starter,
          activityIdea: grounded.activityIdea ?? null,
          score: Math.round(score * 1000) / 1000,
        };
      }),
    );
  }

  private async introDTO(intro: StoredIntroduction): Promise<IntroductionDTO> {
    const [from, to] = await Promise.all([
      this.deps.store.account(intro.fromUserId),
      this.deps.store.account(intro.toUserId),
    ]);
    if (!from || !to) throw notFound('Introduction account not found');
    return {
      ...intro,
      from,
      to,
      createdAt: intro.createdAt.toISOString(),
      conversationId: intro.conversationId,
    };
  }

  async introductions(userId: string) {
    return Promise.all((await this.deps.store.introductions(userId)).map((intro) => this.introDTO(intro)));
  }

  async requestIntroduction(userId: string, toUserId: string, firstMessage?: string) {
    if (userId === toUserId) throw badRequest('Choose another person');
    const targetAccount = await this.deps.store.account(toUserId);
    const match = targetAccount
      ? (await this.matches(userId)).find((card) => card.account.id === targetAccount.id)
      : null;
    if (!match) throw forbidden('An introduction can only be requested from a current match');
    const intro = await this.deps.store.createIntroduction({
      fromUserId: userId,
      toUserId,
      basis: { sharedTags: match.sharedTags, reason: match.reason },
      firstMessage: firstMessage?.trim() || match.starter,
    });
    await this.deps
      .impact?.({
        kind: 'intro_requested',
        actorId: userId,
        objectId: intro.id,
      })
      .catch(() => undefined);
    return this.introDTO(intro);
  }

  async proposeIntroduction(userId: string, toUserId: string) {
    const targetAccount = await this.deps.store.account(toUserId);
    const match = targetAccount
      ? (await this.matches(userId)).find((card) => card.account.id === targetAccount.id)
      : null;
    if (!match) throw forbidden('A proposal can only be prepared for a current match');
    return {
      targetUserId: toUserId,
      sharedTags: match.sharedTags,
      reason: match.reason,
      editableStarter: match.starter,
      sent: false,
    };
  }

  async decideIntroduction(id: string, userId: string, action: 'accept' | 'decline') {
    const intro = await this.deps.store.introduction(id);
    if (!intro) throw notFound('Introduction not found');
    if (intro.toUserId !== userId) throw forbidden('Only the recipient can respond');
    if (intro.state !== 'requested') throw badRequest('Introduction was already answered');
    let conversationId: string | null = null;
    if (action === 'accept') {
      const blocked = await this.deps.store.blockedUserIds(userId);
      if (blocked.has(intro.fromUserId)) throw forbidden('This introduction can no longer be accepted');
      conversationId = this.deps.openDirect
        ? await this.deps.openDirect(intro.fromUserId, userId, intro.firstMessage)
        : null;
    }
    const updated = await this.deps.store.setIntroductionState(
      id,
      action === 'accept' ? 'accepted' : 'declined',
      conversationId,
    );
    if (action === 'accept' && conversationId) {
      const chat = await import('../chat/service');
      await chat
        .postMessage(
          conversationId,
          {
            kind: 'card',
            cardKind: 'intro_card',
            cardRefId: intro.id,
            clientId: `intro-card:${intro.id}`,
            body: intro.basis.reason,
          },
          { type: 'system' },
        )
        .catch(() => null);
      await this.deps
        .impact?.({ kind: 'intro_accepted', actorId: userId, objectId: intro.id })
        .catch(() => undefined);
    }
    return this.introDTO(updated);
  }

  async editStarter(id: string, userId: string, firstMessage: string) {
    const intro = await this.deps.store.introduction(id);
    if (!intro) throw notFound('Introduction not found');
    if (intro.fromUserId !== userId || intro.state !== 'requested')
      throw forbidden('Starter is no longer editable');
    return this.introDTO(await this.deps.store.setStarter(id, firstMessage.trim()));
  }

  async overview(userId: string): Promise<DiscoveryOverviewDTO> {
    const [profile, matches, introductions] = await Promise.all([
      this.profile(userId),
      this.matches(userId),
      this.introductions(userId),
    ]);
    return { profile, matches, introductions };
  }

  async refreshDiscoverableProfiles() {
    const profiles = await this.deps.store.discoverableProfiles();
    for (const profile of profiles) {
      const decayed = profile.frozen
        ? { inferred: profile.inferred, touched: profile.inferredTouched ?? {} }
        : decayTouched(profile.inferred, profile.inferredTouched ?? {}, profile.updatedAt, this.deps.now());
      await this.deps.store.saveProfile({
        ...profile,
        inferred: decayed.inferred,
        inferredTouched: decayed.touched,
        embedding: await this.embed({ ...profile, inferred: decayed.inferred }),
      });
    }
    return { refreshed: profiles.length };
  }
}

async function openIntroductionDirect(fromUserId: string, toUserId: string, firstMessage: string | null) {
  const chat = await import('../chat/service');
  const conversation = await chat.createConversation(toUserId, {
    kind: 'dm',
    memberUserIds: [fromUserId],
  });
  if (firstMessage?.trim()) {
    await chat.postMessage(
      conversation.id,
      {
        kind: 'text',
        body: firstMessage.trim(),
        clientId: `intro-starter:${fromUserId}:${toUserId}`,
      },
      { type: 'user', userId: fromUserId },
    );
  }
  return conversation.id;
}

const service = new DiscoveryService({
  store: discoveryRepository,
  embed: embedTexts,
  cache: getRedis,
  now: () => new Date(),
  impact: recordImpactEvent,
  openDirect: openIntroductionDirect,
});
export const getDiscoveryOverview = (userId: string) => service.overview(userId);
export const getDiscoveryProfile = (userId: string) => service.profile(userId);
export const updateDiscoveryProfile = (userId: string, body: DiscoveryProfileBody) =>
  service.updateProfile(userId, body);
export const saveDiscoveryQuiz = (userId: string, body: QuizAnswersBody) => service.saveQuiz(userId, body);
export const listMatches = (userId: string) => service.matches(userId);
export const listIntroductions = (userId: string) => service.introductions(userId);
export const requestIntroduction = (userId: string, toUserId: string, firstMessage?: string) =>
  service.requestIntroduction(userId, toUserId, firstMessage);
export const proposeIntroduction = (userId: string, toUserId: string) =>
  service.proposeIntroduction(userId, toUserId);
export const decideIntroduction = (id: string, userId: string, action: 'accept' | 'decline') =>
  service.decideIntroduction(id, userId, action);
export const editIntroductionStarter = (id: string, userId: string, firstMessage: string) =>
  service.editStarter(id, userId, firstMessage);
export const recordSignal = (userId: string, tags: string[], kind: SignalKind) =>
  service.recordSignal(userId, tags, kind).then(() => undefined);
export const clearGraphSignals = (userId: string, legacyTags?: string[]) =>
  service.clearGraphSignals(userId, legacyTags).then(() => undefined);
export const refreshDiscoverableProfiles = () => service.refreshDiscoverableProfiles();
export async function resolveIntroductionCard(id: string, userId: string) {
  const intro = await discoveryRepository.introduction(id);
  if (!intro || (intro.fromUserId !== userId && intro.toUserId !== userId)) return undefined;
  return service.introductions(userId).then((rows) => rows.find((row) => row.id === id));
}

const CaptionTags = z.array(z.string()).max(3);
export async function tagCaption(caption: string): Promise<string[]> {
  if (!caption.trim()) return [];
  const result = await callStructured(
    CaptionTags,
    [
      {
        role: 'system',
        content: 'Return at most three broad, non-sensitive topic tags for this public post caption.',
      },
      { role: 'user', content: caption.slice(0, 500) },
    ],
    { name: 'commonGroundReason', mockValue: [], maxOutputTokens: 80 },
  );
  return safeTags(result.data, 3);
}
