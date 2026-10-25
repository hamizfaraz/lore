import { RECAP_SYSTEM_PROMPT, callStructured, generateMuseImage, guardText } from '@lore/ai';
import {
  PhotoNotes,
  RecapDraftSpec,
  type PhotoNotes as PhotoNotesType,
  type RecapDraftSpec as RecapDraftSpecType,
} from '@lore/shared/ai';
import type {
  CreateRecapBody,
  PatchRecapBody,
  ProposePostBody,
  RecapCardDTO,
  RecapListDTO,
  ShareRecapBody,
} from '@lore/shared/dto/memories';
import type { MediaDTO } from '@lore/shared/dto/media';
import sharp from 'sharp';
import { z } from 'zod';
import { forbidden, notFound, badRequest } from '../../lib/errors';
import { postMessage } from '../chat/service';
import { createDraft } from '../groups/service';
import { recordImpactEvent } from '../impact/service';
import { createFromBuffer, signedUrl } from '../media/service';
import { renderCollage } from './collage';
import { emitRecapUpdated } from './events';
import { clusterMedia, consentedMedia, groundedRecap, removeNearDuplicates } from './policy';
import { MemoriesRepository, memoriesRepository } from './repository';
import type { MemoryMedia, MemoryMessage, StoredRecap } from './types';

type MemoriesStore = Pick<
  MemoriesRepository,
  | 'membership'
  | 'sourceMessages'
  | 'media'
  | 'list'
  | 'recap'
  | 'consents'
  | 'create'
  | 'patch'
  | 'setConsent'
  | 'mediaOwner'
>;

export type MemoriesDependencies = {
  store: MemoriesStore;
  describe: (media: MemoryMedia[]) => Promise<PhotoNotesType[]>;
  compose: (
    media: MemoryMedia[],
    notes: PhotoNotesType[],
    messages: MemoryMessage[],
  ) => Promise<{ data: RecapDraftSpecType; degraded: boolean }>;
  guard: typeof guardText;
  signedUrl: typeof signedUrl;
  storeMedia: typeof createFromBuffer;
  generateCover: typeof generateMuseImage;
  post: typeof postMessage;
  createDraft: typeof createDraft;
  emit: typeof emitRecapUpdated;
  fetchBytes: (url: string) => Promise<Buffer>;
  impact?: typeof recordImpactEvent;
};

function mockNotes(media: MemoryMedia[]): PhotoNotesType[] {
  return media.map((item) => ({
    mediaId: item.id,
    caption: item.captionAi ?? 'a shared group moment',
    people: 0,
    setting: 'shared moment',
    mood: 'warm',
    quality: item.quality,
  }));
}

function mockDraft(
  media: MemoryMedia[],
  notes: PhotoNotesType[],
  messages: MemoryMessage[],
): RecapDraftSpecType {
  const ordered = [...notes].sort((left, right) => right.quality - left.quality).map((note) => note.mediaId);
  const factsUsed = messages
    .filter((message) => message.body?.trim())
    .slice(0, 2)
    .map((message) => ({ claim: message.body!.trim().slice(0, 140), sourceMessageId: message.id }));
  return {
    title: 'A moment worth keeping',
    caption: notes.length
      ? `A private recap of ${notes.length} shared ${notes.length === 1 ? 'moment' : 'moments'}.`
      : 'A private group recap.',
    orderedMediaIds: ordered,
    coverMediaId: ordered[0] ?? media[0]!.id,
    layout: ordered.length > 1 ? 'collage' : 'carousel',
    coverPrompt: 'a warm editorial still life inspired by friendship, no faces, LORE house style',
    musicVibe: 'warm and reflective',
    factsUsed,
  };
}

async function fetchMediaBytes(url: string): Promise<Buffer> {
  const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`Media download failed: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function describePhotos(media: MemoryMedia[]): Promise<PhotoNotesType[]> {
  const content: Array<
    { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string; detail: 'low' } }
  > = [{ type: 'text', text: 'Describe only the supplied photos. Preserve each media id exactly.' }];
  for (const item of media.slice(0, 6)) {
    content.push({ type: 'text', text: `mediaId=${item.id}` });
    const url = await signedUrl(item.id).catch(() => null);
    if (!url) continue;
    const bytes = await fetchMediaBytes(url).catch(() => null);
    if (!bytes) continue;
    const review = await sharp(bytes)
      .rotate()
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    content.push({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${review.toString('base64')}`, detail: 'low' },
    });
  }
  const result = await callStructured(
    z.array(PhotoNotes),
    [
      { role: 'system', content: RECAP_SYSTEM_PROMPT },
      { role: 'user', content },
    ],
    { name: 'photoNotes', mockValue: mockNotes(media), timeoutMs: 8_000 },
  );
  return result.data;
}

const defaultDependencies: MemoriesDependencies = {
  store: memoriesRepository,
  describe: describePhotos,
  compose: async (media, notes, messages) => {
    const result = await callStructured(
      RecapDraftSpec,
      [
        { role: 'system', content: RECAP_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `PHOTO NOTES\n${JSON.stringify(notes)}\nMESSAGES\n${JSON.stringify(messages)}\nALLOWED MEDIA\n${media.map((item) => item.id).join(',')}`,
        },
      ],
      { name: 'recapDraftSpec', mockValue: mockDraft(media, notes, messages), timeoutMs: 8_000 },
    );
    return { data: result.data, degraded: result.degraded };
  },
  guard: guardText,
  signedUrl,
  storeMedia: createFromBuffer,
  generateCover: generateMuseImage,
  post: postMessage,
  createDraft,
  emit: emitRecapUpdated,
  fetchBytes: fetchMediaBytes,
  impact: recordImpactEvent,
};

export class MemoriesService {
  constructor(private readonly deps: MemoriesDependencies = defaultDependencies) {}

  private async requireMember(conversationId: string, userId: string) {
    const membership = await this.deps.store.membership(conversationId, userId);
    if (!membership) throw forbidden('Conversation membership required');
    return membership;
  }

  private async memberRecap(recapId: string, userId: string): Promise<StoredRecap> {
    const recap = await this.deps.store.recap(recapId);
    if (!recap) throw notFound('Recap not found');
    await this.requireMember(recap.conversationId, userId);
    return recap;
  }

  private async mediaDto(media: MemoryMedia): Promise<MediaDTO> {
    const url = (await this.deps.signedUrl(media.id).catch(() => null)) ?? `/v1/media/${media.id}`;
    const thumbUrl = (await this.deps.signedUrl(media.id, { thumb: true }).catch(() => null)) ?? null;
    return {
      id: media.id,
      kind: media.kind,
      url,
      thumbUrl,
      mime: media.mime,
      width: media.width,
      height: media.height,
      durationMs: media.durationMs,
      blurhash: media.blurhash,
      aiGenerated: media.aiGenerated,
      generator: media.generator,
      transcript: media.transcript,
      transcriptStatus: media.transcriptStatus,
      altText: media.captionAi,
    };
  }

  private async card(recap: StoredRecap): Promise<RecapCardDTO> {
    const [allMedia, consents] = await Promise.all([
      this.deps.store.media(recap.conversationId, recap.mediaIds),
      this.deps.store.consents(recap.id),
    ]);
    const media = consentedMedia(allMedia, consents).filter((item) => recap.mediaIds.includes(item.id));
    const [coverUrl, collageUrl] = await Promise.all([
      recap.coverMediaId ? this.deps.signedUrl(recap.coverMediaId).catch(() => null) : null,
      recap.collageMediaId ? this.deps.signedUrl(recap.collageMediaId).catch(() => null) : null,
    ]);
    return {
      id: recap.id,
      conversationId: recap.conversationId,
      title: recap.title,
      caption: recap.caption,
      layout: recap.layout,
      state: recap.state,
      coverUrl,
      coverAiGenerated: Boolean(recap.coverMediaId && !recap.mediaIds.includes(recap.coverMediaId)),
      collageUrl,
      media: await Promise.all(media.map((item) => this.mediaDto(item))),
      musicLabel: recap.musicLabel,
      createdByAi: recap.createdByAi,
      factsUsed: recap.factsUsed ?? [],
    };
  }

  async list(conversationId: string, userId: string): Promise<RecapListDTO> {
    await this.requireMember(conversationId, userId);
    const rows = await this.deps.store.list(conversationId);
    return { recaps: await Promise.all(rows.map((row) => this.card(row))) };
  }

  async get(recapId: string, userId: string): Promise<RecapCardDTO> {
    return this.card(await this.memberRecap(recapId, userId));
  }

  private async render(media: MemoryMedia[], layout: StoredRecap['layout']): Promise<string | null> {
    const buffers: Buffer[] = [];
    for (const item of media
      .filter((entry) => entry.kind === 'image' || entry.kind === 'generated_image')
      .slice(0, 4)) {
      const url = await this.deps.signedUrl(item.id).catch(() => null);
      if (!url) continue;
      const bytes = await this.deps.fetchBytes(url).catch(() => null);
      if (bytes) buffers.push(bytes);
    }
    if (!buffers.length) return null;
    const rendered = await renderCollage(buffers, layout);
    const stored = await this.deps.storeMedia(rendered, {
      kind: 'render',
      mime: 'image/jpeg',
      aiGenerated: true,
      generator: 'lore-sharp-collage-v1',
      width: 1080,
      height: 1350,
      captionAi: 'AI-arranged private recap collage',
    });
    return stored.id;
  }

  async create(conversationId: string, userId: string, body: CreateRecapBody): Promise<RecapCardDTO> {
    await this.requireMember(conversationId, userId);
    const [available, messages] = await Promise.all([
      this.deps.store.media(conversationId, body.mediaIds),
      this.deps.store.sourceMessages(conversationId),
    ]);
    const allowed = removeNearDuplicates(consentedMedia(available)).filter(
      (item) => item.kind === 'image' || item.kind === 'generated_image',
    );
    const clustered = body.mediaIds?.length ? allowed : (clusterMedia(allowed).at(-1) ?? allowed.slice(0, 6));
    if (!clustered.length) throw badRequest('Choose at least one consented image from this conversation');
    const notes = await this.deps.describe(clustered);
    const composed = await this.deps.compose(clustered, notes, messages);
    const draft = groundedRecap(composed.data, messages, clustered);
    const verdict = await this.deps.guard(`${draft.title}\n${draft.caption}`);
    if (!verdict.allow) throw badRequest('The recap draft needs review before it can be created');
    const collageMediaId = await this.render(clustered, draft.layout).catch(() => null);
    const stored = await this.deps.store.create(
      {
        conversationId,
        eventId: body.eventId ?? null,
        planId: body.planId ?? null,
        title: draft.title,
        caption: draft.caption,
        layout: draft.layout,
        mediaIds: draft.orderedMediaIds,
        coverMediaId: draft.coverMediaId,
        collageMediaId,
        musicLabel: draft.musicVibe,
        factsUsed: draft.factsUsed,
        state: 'ready_private',
        createdByAi: true,
      },
      clustered,
    );
    const card = await this.card(stored);
    await this.deps
      .impact?.({
        kind: 'recap_ready',
        groupId: conversationId,
        actorId: userId,
        objectId: stored.id,
        props: { mediaCount: stored.mediaIds.length },
      })
      .catch(() => undefined);
    await this.deps
      .post(
        conversationId,
        {
          kind: 'card',
          cardKind: 'recap_card',
          cardRefId: stored.id,
          clientId: `recap-offer:${stored.id}`,
          meta: { private: true, degraded: composed.degraded },
        },
        { type: 'user', userId },
      )
      .catch(() => null);
    this.deps.emit(card);
    return card;
  }

  async patch(recapId: string, userId: string, body: PatchRecapBody): Promise<RecapCardDTO> {
    const recap = await this.memberRecap(recapId, userId);
    const consents = await this.deps.store.consents(recapId);
    const revoked = new Set(consents.filter((consent) => !consent.include).map((consent) => consent.mediaId));
    if (body.mediaIds?.some((id) => revoked.has(id)))
      throw forbidden('Revoked media cannot be restored to a recap');
    let coverMediaId: string | undefined;
    let collageMediaId: string | undefined;
    const mediaIds = body.mediaIds ?? recap.mediaIds;
    const media = consentedMedia(await this.deps.store.media(recap.conversationId, mediaIds), consents);
    if (body.regenerateCover) {
      if (!media.length) throw badRequest('A consented source image is required for a generated cover');
      const image = await this.deps.generateCover({
        prompt: 'A warm editorial still life inspired by a shared group memory, no faces, LORE house style',
      });
      const stored = await this.deps.storeMedia(image.bytes, {
        kind: 'generated_image',
        mime: image.mime,
        aiGenerated: true,
        generator: image.model,
        captionAi: 'AI illustration for a private recap',
      });
      coverMediaId = stored.id;
    }
    if (body.layout || body.mediaIds) {
      collageMediaId = (await this.render(media, body.layout ?? recap.layout).catch(() => null)) ?? undefined;
    }
    const updated = await this.deps.store.patch(recapId, {
      ...body,
      mediaIds,
      ...(coverMediaId ? { coverMediaId } : {}),
      ...(collageMediaId ? { collageMediaId } : {}),
      state: 'edited',
    });
    if (!updated) throw notFound('Recap not found');
    const card = await this.card(updated);
    this.deps.emit(card);
    return card;
  }

  async consent(recapId: string, userId: string, mediaId: string, include: boolean): Promise<RecapCardDTO> {
    const recap = await this.memberRecap(recapId, userId);
    const owner = await this.deps.store.mediaOwner(mediaId);
    if (owner !== userId) throw forbidden('Only the media owner can change recap consent');
    await this.deps.store.setConsent(recapId, mediaId, userId, include);
    const mediaIds = include
      ? [...new Set([...recap.mediaIds, mediaId])]
      : recap.mediaIds.filter((id) => id !== mediaId);
    const updated = await this.deps.store.patch(recapId, {
      mediaIds,
      ...(recap.coverMediaId === mediaId ? { coverMediaId: null } : {}),
      state: 'edited',
    });
    if (!updated) throw notFound('Recap not found');
    const card = await this.card(updated);
    this.deps.emit(card);
    return card;
  }

  async proposePost(recapId: string, userId: string, body: ProposePostBody) {
    const recap = await this.memberRecap(recapId, userId);
    const card = await this.card(recap);
    const mediaIds = card.media.map((item) => item.id);
    if (recap.collageMediaId) mediaIds.unshift(recap.collageMediaId);
    if (!mediaIds.length) throw badRequest('A consented media item is required');
    const draft = await this.deps.createDraft(
      {
        accountId: body.accountId,
        conversationId: recap.conversationId,
        kind: mediaIds.length > 1 ? 'carousel' : 'photo',
        caption: body.caption ?? recap.caption,
        mediaIds: mediaIds.slice(0, 10),
        source: { kind: 'recap', id: recap.id },
        createdByAi: true,
        submit: true,
      },
      { type: 'user', userId },
    );
    await this.deps.store.patch(recapId, { state: 'proposed' });
    return draft;
  }

  async share(recapId: string, userId: string, body: ShareRecapBody): Promise<RecapCardDTO> {
    const recap = await this.memberRecap(recapId, userId);
    if (body.target === 'story') {
      throw badRequest('Story creation requires the C1 story service integration');
    }
    await this.deps.post(
      recap.conversationId,
      {
        kind: 'card',
        cardKind: 'recap_card',
        cardRefId: recap.id,
        clientId: `recap-share:${recap.id}:${Date.now()}`,
        meta: { private: true },
      },
      { type: 'user', userId },
    );
    return this.card(recap);
  }

  async save(recapId: string, userId: string): Promise<RecapCardDTO> {
    await this.memberRecap(recapId, userId);
    const updated = await this.deps.store.patch(recapId, { state: 'saved' });
    if (!updated) throw notFound('Recap not found');
    return this.card(updated);
  }
}

export const memoriesService = new MemoriesService();
export const listRecaps = memoriesService.list.bind(memoriesService);
export const getRecap = memoriesService.get.bind(memoriesService);
export const createRecap = memoriesService.create.bind(memoriesService);
export const patchRecap = memoriesService.patch.bind(memoriesService);
export const setRecapConsent = memoriesService.consent.bind(memoriesService);
export const proposeRecapPost = memoriesService.proposePost.bind(memoriesService);
export const shareRecap = memoriesService.share.bind(memoriesService);
export const saveRecap = memoriesService.save.bind(memoriesService);
