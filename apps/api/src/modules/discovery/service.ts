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
import { decayScores, matchScore, safeTags, visibleInferred } from './policy';
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
    for (const tag of removed) inferred[tag] = -1;
    for (const tag of explicitTags) if (inferred[tag]! < 0) delete inferred[tag];
    const next = {
      ...current,
      explicitTags,
      inferred,
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
    if (current.frozen) return profileDTO(current, userId);
    const inferred = decayScores(current.inferred, this.deps.now().getTime() - current.updatedAt.getTime());
    for (const tag of safeTags(tags, 3)) {
      if (inferred[tag]! < 0 || current.explicitTags.includes(tag)) continue;
      inferred[tag] = Math.min(1, (inferred[tag] ?? 0) + SIGNAL_WEIGHT[kind]);
    }
    const next = { ...current, inferred };
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
    const [candidates, connected] = await Promise.all([
      this.deps.store.candidates(userId),
      this.deps.store.connectedUserIds(userId),
    ]);
    const ownTags = profileTags(current);
    const ranked = candidates
      .filter((candidate) => !connected.has(candidate.userId))
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
    return { ...intro, from, to, createdAt: intro.createdAt.toISOString(), conversationId: null };
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
    // C1 opens the direct conversation only after the accepted state is returned.
    return this.introDTO(
      await this.deps.store.setIntroductionState(id, action === 'accept' ? 'accepted' : 'declined'),
    );
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
      const inferred = profile.frozen
        ? profile.inferred
        : decayScores(profile.inferred, this.deps.now().getTime() - profile.updatedAt.getTime());
      await this.deps.store.saveProfile({
        ...profile,
        inferred,
        embedding: await this.embed({ ...profile, inferred }),
      });
    }
    return { refreshed: profiles.length };
  }
}

const service = new DiscoveryService({
  store: discoveryRepository,
  embed: embedTexts,
  cache: getRedis,
  now: () => new Date(),
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
export const refreshDiscoverableProfiles = () => service.refreshDiscoverableProfiles();

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
