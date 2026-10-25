import { describe, expect, it, vi } from 'vitest';
import { MemoriesService, type MemoriesDependencies } from './service';
import type { MemoryMedia, StoredRecap } from './types';

const item: MemoryMedia = {
  id: '00000000-0000-7000-8000-000000000201',
  ownerUserId: 'u1',
  kind: 'image',
  mime: 'image/jpeg',
  width: 100,
  height: 100,
  durationMs: null,
  blurhash: null,
  aiGenerated: false,
  generator: null,
  transcript: null,
  transcriptStatus: 'none',
  captionAi: 'friends around a table',
  consentScope: null,
  createdAt: new Date('2026-10-24T18:00:00Z'),
  sourceMessageIds: ['00000000-0000-7000-8000-000000000301'],
  quality: 0.9,
  perceptualHash: null,
};
const recap: StoredRecap = {
  id: '00000000-0000-7000-8000-000000000401',
  conversationId: '00000000-0000-7000-8000-000000000001',
  eventId: null,
  planId: null,
  title: 'A moment worth keeping',
  caption: 'A private recap.',
  layout: 'carousel',
  mediaIds: [item.id],
  coverMediaId: item.id,
  collageMediaId: null,
  musicLabel: 'warm',
  factsUsed: [{ claim: 'friends met', sourceMessageId: item.sourceMessageIds[0]! }],
  state: 'ready_private',
  createdByAi: true,
  createdAt: new Date(),
};

function makeService() {
  const consentRows: Array<{ recapId: string; mediaId: string; ownerUserId: string; include: boolean }> = [];
  const create = vi.fn(async (input) => ({ ...recap, ...input }));
  const patch = vi.fn(async (_id, input) => ({ ...recap, ...input }));
  const setConsent = vi.fn(
    async (recapId: string, mediaId: string, ownerUserId: string, include: boolean) => {
      consentRows.splice(0, consentRows.length, { recapId, mediaId, ownerUserId, include });
    },
  );
  const createDraft = vi.fn(async () => ({ id: 'draft' }));
  const store = {
    membership: vi.fn(async () => ({ role: 'member' })),
    sourceMessages: vi.fn(async () => [
      { id: item.sourceMessageIds[0]!, body: 'friends met', createdAt: new Date() },
    ]),
    media: vi.fn(async () => [item]),
    list: vi.fn(async () => [recap]),
    recap: vi.fn(async () => recap),
    consents: vi.fn(async () => consentRows),
    create,
    patch,
    setConsent,
    mediaOwner: vi.fn(async () => 'u1'),
  };
  const deps = {
    store,
    describe: vi.fn(async () => [
      { mediaId: item.id, caption: 'friends', people: 3, setting: 'home', mood: 'warm', quality: 0.9 },
    ]),
    compose: vi.fn(async () => ({
      degraded: false,
      data: {
        title: recap.title,
        caption: recap.caption,
        orderedMediaIds: [item.id],
        coverMediaId: item.id,
        layout: 'carousel',
        coverPrompt: 'warm',
        musicVibe: 'warm',
        factsUsed: recap.factsUsed,
      },
    })),
    guard: vi.fn(async () => ({ allow: true, category: 'ok', severity: 0 })),
    signedUrl: vi.fn(async () => null),
    storeMedia: vi.fn(),
    generateCover: vi.fn(),
    post: vi.fn(async () => {
      throw new Error('C1 not merged');
    }),
    createDraft,
    emit: vi.fn(),
    fetchBytes: vi.fn(),
  };
  return {
    service: new MemoriesService(deps as unknown as MemoriesDependencies),
    store,
    create,
    patch,
    setConsent,
    createDraft,
  };
}

describe('MemoriesService', () => {
  it('creates a private, grounded recap and labels it AI-created', async () => {
    const { service, create } = makeService();
    const result = await service.create(recap.conversationId, 'u1', { mediaIds: [item.id] });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'ready_private', createdByAi: true }),
      [item],
    );
    expect(result.state).toBe('ready_private');
    expect(result.createdByAi).toBe(true);
    expect(result.factsUsed[0]?.sourceMessageId).toBe(item.sourceMessageIds[0]);
  });

  it('lets only the owner revoke media and removes it from all later recap output', async () => {
    const { service, setConsent, patch } = makeService();
    const result = await service.consent(recap.id, 'u1', item.id, false);
    expect(setConsent).toHaveBeenCalledWith(recap.id, item.id, 'u1', false);
    expect(patch).toHaveBeenCalledWith(
      recap.id,
      expect.objectContaining({ mediaIds: [], coverMediaId: null }),
    );
    expect(result.media).toEqual([]);
  });

  it('hands a consent-filtered AI draft to C1 governance instead of publishing', async () => {
    const { service, createDraft } = makeService();
    await service.proposePost(recap.id, 'u1', { accountId: 'account-1' });
    expect(createDraft).toHaveBeenCalledWith(
      expect.objectContaining({ source: { kind: 'recap', id: recap.id }, createdByAi: true, submit: true }),
      { type: 'user', userId: 'u1' },
    );
  });
});
