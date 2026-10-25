import type { DiscoveryCandidate, StoredInterestProfile, StoredIntroduction } from './types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscoveryService, type DiscoveryDependencies, type SignalKind } from './service';

const now = new Date('2026-10-24T12:00:00Z');
const account = (id: string, name: string) => ({
  id: `account-${id}`,
  type: 'personal' as const,
  handle: name.toLowerCase(),
  displayName: name,
  avatarUrl: null,
  visibility: 'public' as const,
  conversationId: null,
});
const profile = (userId: string, overrides: Partial<StoredInterestProfile> = {}): StoredInterestProfile => ({
  userId,
  explicitTags: ['climbing'],
  inferred: {},
  inferredTouched: {},
  graphTags: [],
  frozen: false,
  discoverable: true,
  bioSnippet: null,
  embedding: [1, 0],
  updatedAt: now,
  ...overrides,
});

function setup(initial = profile('me')) {
  let mine = initial;
  let intro: StoredIntroduction = {
    id: 'intro-1',
    fromUserId: 'other',
    toUserId: 'me',
    basis: { sharedTags: ['climbing'], reason: 'Both chose climbing.' },
    firstMessage: 'Want to climb?',
    state: 'requested',
    conversationId: null,
    createdAt: now,
  };
  const other: DiscoveryCandidate = { ...profile('other'), account: account('other', 'Sam') };
  const store = {
    profile: vi.fn(async (id: string) => (id === 'me' ? mine : profile(id))),
    saveProfile: vi.fn(async (value: StoredInterestProfile) => {
      mine = { ...value, updatedAt: now };
      return mine;
    }),
    saveQuiz: vi.fn(async () => undefined),
    candidates: vi.fn(async () => [other]),
    connectedUserIds: vi.fn(async () => new Set<string>()),
    blockedUserIds: vi.fn(async () => new Set<string>()),
    discoverableProfiles: vi.fn(async () => [mine]),
    account: vi.fn(async (id: string) => account(id, id === 'me' ? 'Ava' : 'Sam')),
    introductions: vi.fn(async () => [intro]),
    introduction: vi.fn(async () => intro),
    createIntroduction: vi.fn(
      async (value: Omit<StoredIntroduction, 'id' | 'createdAt' | 'state' | 'conversationId'>) => ({
        ...value,
        id: 'new-intro',
        state: 'requested' as const,
        conversationId: null,
        createdAt: now,
      }),
    ),
    setIntroductionState: vi.fn(
      async (_id: string, state: StoredIntroduction['state'], conversationId?: string | null) => {
        intro = { ...intro, state, conversationId: conversationId ?? intro.conversationId };
        return intro;
      },
    ),
    setStarter: vi.fn(async (_id: string, firstMessage: string) => {
      intro = { ...intro, firstMessage };
      return intro;
    }),
  };
  const cache = { get: vi.fn(async () => null), setex: vi.fn(async () => 'OK') };
  const service = new DiscoveryService({
    store,
    embed: vi.fn(async () => [[1, 0]]),
    cache: () => cache,
    now: () => now,
  } as unknown as DiscoveryDependencies);
  return { service, store, cache, current: () => mine };
}

describe('DiscoveryService consent boundaries', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns no candidates and performs no candidate lookup before opt-in', async () => {
    const { service, store } = setup(profile('me', { discoverable: false }));
    await expect(service.matches('me')).resolves.toEqual([]);
    expect(store.candidates).not.toHaveBeenCalled();
  });

  it('records all five allowed public signal kinds, honors removal, and freezes inference', async () => {
    const { service, current } = setup(profile('me', { explicitTags: [], inferred: {} }));
    for (const kind of ['like', 'save', 'share', 'follow', 'graph'] as SignalKind[])
      await service.recordSignal('me', [kind, 'private health'], kind);
    expect(Object.keys(current().inferred)).toEqual(
      expect.arrayContaining(['like', 'save', 'share', 'follow', 'graph']),
    );
    expect(current().inferred).not.toHaveProperty('private health');
    await service.updateProfile('me', { removedTags: ['like'], frozen: true });
    await service.recordSignal('me', ['like', 'photography'], 'save');
    expect(current().inferred.like).toBe(-1);
    expect(current().inferred).not.toHaveProperty('photography');
  });

  it('replaces Graph suggestions and removes the prior set when disconnected', async () => {
    const { service, current } = setup(profile('me', { explicitTags: [], inferred: {} }));
    await service.recordSignal('me', ['climbing', 'music'], 'graph');
    expect(current().graphTags).toEqual(['climbing', 'music']);
    expect(current().inferred).toMatchObject({ climbing: 0.25, music: 0.25 });

    await service.recordSignal('me', ['cooking'], 'graph');
    expect(current().graphTags).toEqual(['cooking']);
    expect(current().inferred).not.toHaveProperty('climbing');
    expect(current().inferred).not.toHaveProperty('music');
    expect(current().inferred.cooking).toBe(0.25);

    await service.recordSignal('me', [], 'graph');
    expect(current().graphTags).toEqual([]);
    expect(current().inferred).not.toHaveProperty('cooking');
  });

  it('grounds prompts and cache entries in allowed shared tags only', async () => {
    const { service, cache } = setup();
    const [match] = await service.matches('me');
    expect(match?.sharedTags).toEqual(['climbing']);
    expect(JSON.stringify(cache.setex.mock.calls)).not.toContain('private chat');
  });

  it('declines silently and exposes no conversation before mutual acceptance', async () => {
    const { service, store } = setup();
    const declined = await service.decideIntroduction('intro-1', 'me', 'decline');
    expect(declined.state).toBe('declined');
    expect(declined.conversationId).toBeNull();
    expect(store.setIntroductionState).toHaveBeenCalledWith('intro-1', 'declined', null);
  });

  it('opens a direct chat when the recipient accepts', async () => {
    const { service, store } = setup();
    const openDirect = vi.fn(async () => 'dm-1');
    const accepting = new DiscoveryService({
      store,
      embed: vi.fn(async () => [[1, 0]]),
      cache: () => ({ get: vi.fn(async () => null), setex: vi.fn(async () => 'OK') }),
      now: () => now,
      openDirect,
    } as unknown as DiscoveryDependencies);
    const accepted = await accepting.decideIntroduction('intro-1', 'me', 'accept');
    expect(openDirect).toHaveBeenCalledWith('other', 'me', 'Want to climb?');
    expect(accepted.conversationId).toBe('dm-1');
    expect(accepted.state).toBe('accepted');
  });
});
