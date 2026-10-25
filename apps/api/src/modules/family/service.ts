import { FAMILY_STORY_SYSTEM_PROMPT, callStructured } from '@lore/ai';
import { FamilyStorySpec } from '@lore/shared/ai';
import type { FamilyStoryDetailDTO, FamilyContributionBody, FamilyShareBody } from '@lore/shared/dto/family';
import type { Actor } from '../../lib/actor';
import { badRequest, forbidden, notFound } from '../../lib/errors';
import { postMessage } from '../chat/service';
import { createDraft } from '../groups/service';
import { assertGroundedFamilyStory } from './policy';
import { FamilyRepository, familyRepository } from './repository';

type Dependencies = { store: FamilyRepository; draft: typeof createDraft };
const defaultDependencies: Dependencies = { store: familyRepository, draft: createDraft };

export class FamilyService {
  constructor(private readonly deps: Dependencies = defaultDependencies) {}

  private async accessible(storyId: string, userId: string) {
    const story = await this.deps.store.story(storyId);
    if (!story) throw notFound('Family story not found');
    const membership = await this.deps.store.membership(story.conversationId, userId);
    if (!membership) throw forbidden('Only current group members can open this story');
    return { story, membership };
  }

  async create(conversationId: string, userId: string, body: { from: string; to: string }) {
    const membership = await this.deps.store.membership(conversationId, userId);
    if (!membership) throw forbidden('Only current group members can create a story');
    const from = new Date(body.from);
    const to = new Date(body.to);
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from > to) {
      throw badRequest('Choose a valid date range');
    }
    const story = await this.deps.store.create(conversationId, from, to);
    return this.detail(story.id, userId);
  }

  async detail(storyId: string, userId: string): Promise<FamilyStoryDetailDTO> {
    const { story } = await this.accessible(storyId, userId);
    const sources = await this.deps.store.sources(storyId);
    const contributors = [
      ...new Map(sources.map((source) => [source.contributorUserId, source])).values(),
    ].map((source) => ({
      userId: source.contributorUserId,
      displayName: source.contributorName,
      avatarUrl: source.contributorAvatarUrl,
    }));
    const names = new Map(sources.map((source) => [source.contributorUserId, source.contributorName]));
    return {
      id: story.id,
      conversationId: story.conversationId,
      title: story.title,
      periodLabel: story.periodLabel ?? '',
      state: story.state,
      coverUrl: null,
      chapterCount: story.chapters?.length ?? 0,
      flagsOpen: story.flags?.length ?? 0,
      contributors,
      sources: sources.map((source) => ({
        sourceMessageId: source.sourceMessageId,
        contributorUserId: source.contributorUserId,
        contributorName: source.contributorName,
        contributorAvatarUrl: source.contributorAvatarUrl,
        createdAt: source.createdAt.toISOString(),
        text: source.text,
        media: source.media,
        include: source.include,
        correction: source.correction,
      })),
      chapters: (story.chapters ?? []).map((chapter) => ({
        ...chapter,
        items: chapter.items.map((item) => ({
          ...item,
          contributorName: names.get(item.contributorUserId) ?? 'Contributor',
        })),
      })),
      flags: story.flags ?? [],
      canGenerate: sources.some((source) => source.include),
      canShare: Boolean(story.chapters?.length) && !(story.flags?.length ?? 0),
    };
  }

  async updateSource(storyId: string, sourceMessageId: string, userId: string, body: FamilyContributionBody) {
    await this.accessible(storyId, userId);
    const source = (await this.deps.store.sources(storyId)).find(
      (item) => item.sourceMessageId === sourceMessageId,
    );
    if (!source) throw notFound('Story source not found');
    if (source.contributorUserId !== userId) throw forbidden('Only the contributor can change this source');
    await this.deps.store.updateSource(storyId, sourceMessageId, body);
    if (body.correction?.trim()) await this.deps.store.resolveFlag(storyId, sourceMessageId);
    return this.detail(storyId, userId);
  }

  async generate(storyId: string, userId: string) {
    await this.accessible(storyId, userId);
    const included = (await this.deps.store.sources(storyId)).filter((source) => source.include);
    if (!included.length) throw badRequest('Select at least one source');
    const fallback: FamilyStorySpec = {
      title: 'The Iqbals, lately',
      periodLabel: 'October 2026',
      chapters: [
        {
          heading: 'Stories worth keeping',
          summary: 'A small collection of moments the family chose to preserve.',
          items: included.map((source) => ({
            sourceMessageId: source.sourceMessageId,
            contributorUserId: source.contributorUserId,
            text: source.text,
          })),
        },
      ],
      flags: included
        .filter((source) => /check the year|unclear|not sure/i.test(source.text))
        .map((source) => ({ sourceMessageId: source.sourceMessageId, issue: 'date_unclear' as const })),
      coverPrompt: 'an editorial family scrapbook with warm paper textures, no faces',
    };
    const result = await callStructured(
      FamilyStorySpec,
      [
        { role: 'system', content: FAMILY_STORY_SYSTEM_PROMPT },
        {
          role: 'user',
          content: JSON.stringify(
            included.map((source) => ({
              sourceMessageId: source.sourceMessageId,
              contributorUserId: source.contributorUserId,
              text: source.text,
              media: source.media,
            })),
          ),
        },
      ],
      { name: 'familyStorySpec', mockValue: fallback, maxOutputTokens: 1200 },
    );
    await this.deps.store.saveSpec(storyId, assertGroundedFamilyStory(result.data, included));
    return this.detail(storyId, userId);
  }

  async share(storyId: string, userId: string, body: FamilyShareBody) {
    const { story } = await this.accessible(storyId, userId);
    if (!story.chapters?.length) throw badRequest('Generate the private story first');
    if (story.flags?.length) throw badRequest('Resolve every source flag before sharing');
    if (body.target === 'private') {
      await this.deps.store.setState(storyId, 'shared_private');
      const shared = await this.detail(storyId, userId);
      await postMessage(
        story.conversationId,
        {
          kind: 'card',
          cardKind: 'family_story_card',
          cardRefId: story.id,
          clientId: `family-story:${story.id}`,
          body: shared.title,
        },
        { type: 'user', userId },
      ).catch(() => null);
      return { story: shared, draft: null };
    }
    if (!body.accountId) throw badRequest('A group account is required for public review');
    const draft = await this.deps.draft(
      {
        accountId: body.accountId,
        conversationId: story.conversationId,
        kind: 'carousel',
        caption: story.title,
        mediaIds: story.coverMediaId ? [story.coverMediaId] : [],
        source: { kind: 'family', id: story.id },
        createdByAi: true,
        submit: true,
      },
      { type: 'user', userId } as Actor,
    );
    return { story: await this.detail(storyId, userId), draft };
  }
}

const service = new FamilyService();
export const createFamilyStory = service.create.bind(service);
export const getFamilyStory = service.detail.bind(service);
export const updateFamilySource = service.updateSource.bind(service);
export const generateFamilyStory = service.generate.bind(service);
export const shareFamilyStory = service.share.bind(service);
export async function resolveFamilyStoryCard(storyId: string, userId: string) {
  try {
    const story = await service.detail(storyId, userId);
    return {
      id: story.id,
      conversationId: story.conversationId,
      title: story.title,
      periodLabel: story.periodLabel,
      state: story.state,
      coverUrl: story.coverUrl,
      chapterCount: story.chapterCount,
      flagsOpen: story.flagsOpen,
      contributors: story.contributors,
    };
  } catch {
    return undefined;
  }
}
