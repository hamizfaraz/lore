import type { PodcastShowDetailDTO } from '@lore/shared/dto/podcast';
import { env } from '../../lib/env';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors';
import { createFromBuffer } from '../media/service';
import { assertFinishable, assertPodcastClip } from './policy';
import { PodcastRepository, podcastRepository } from './repository';
import { renderPodcastAudio } from './render';

type Dependencies = {
  store: PodcastRepository;
  now: () => Date;
  render: typeof renderPodcastAudio;
  save: typeof createFromBuffer;
};
const defaults: Dependencies = {
  store: podcastRepository,
  now: () => new Date(),
  render: renderPodcastAudio,
  save: createFromBuffer,
};

export class PodcastService {
  constructor(private readonly deps: Dependencies = defaults) {}

  private async accessible(showId: string, userId: string) {
    const show = await this.deps.store.show(showId);
    if (!show) throw notFound('Podcast show not found');
    if (!(await this.deps.store.membership(show.conversationId, userId)))
      throw forbidden('Only current group members can open this show');
    return show;
  }

  async create(conversationId: string, title: string, userId: string) {
    if (!(await this.deps.store.membership(conversationId, userId)))
      throw forbidden('Only current group members can create a show');
    const showId = await this.deps.store.create(conversationId, userId, title.trim());
    return this.detail(showId, userId);
  }

  async detail(showId: string, userId: string): Promise<PodcastShowDetailDTO> {
    const show = await this.accessible(showId, userId);
    const [stations, members] = await Promise.all([
      this.deps.store.stations(showId),
      this.deps.store.currentMembers(show.conversationId),
    ]);
    const contributions = await this.deps.store.contributions(stations.map((station) => station.id));
    const engaged = [...new Set(contributions.map((item) => item.userId))];
    const missing = show.requiredParticipantIds.filter((id) => !engaged.includes(id));
    const names = new Map(members.map((member) => [member.userId, member.displayName]));
    return {
      showId: show.id,
      conversationId: show.conversationId,
      title: show.title,
      hostUserId: show.hostUserId,
      contributions: contributions.length,
      engaged,
      missing,
      wrapped: Boolean(show.wrappedAt),
      finishEnabled: Boolean(show.wrappedAt) && !missing.length,
      state: show.state,
      requiredParticipants: show.requiredParticipantIds.map((id) => ({
        userId: id,
        displayName: names.get(id) ?? 'Member',
        contributed: engaged.includes(id),
      })),
      stations: stations.map((station) => ({
        id: station.id,
        parentStationId: station.parentStationId,
        topic: station.topic,
        participantIds: station.participantIds,
        state: station.state,
        contributions: contributions
          .filter((item) => item.stationId === station.id)
          .map((item) => ({ ...item, day: item.day, createdAt: item.createdAt.toISOString() })),
      })),
      audioUrl: show.state === 'finished' ? `/v1/podcasts/${show.id}/audio` : null,
    };
  }

  async contribute(
    showId: string,
    stationId: string,
    userId: string,
    body: { mediaId: string; replyToId?: string },
  ) {
    const show = await this.accessible(showId, userId);
    if (show.wrappedAt) throw conflict('This show is already wrapped');
    const station = (await this.deps.store.stations(showId)).find((item) => item.id === stationId);
    if (!station) throw notFound('Podcast station not found');
    if (!station.participantIds.includes(userId))
      throw forbidden('You are not a participant in this station');
    const media = await this.deps.store.media(body.mediaId);
    if (!media?.completedAt || media.durationMs === null) throw badRequest('Voice clip is not ready');
    assertPodcastClip(media as { durationMs: number; kind: string; ownerUserId: string | null }, userId);
    try {
      await this.deps.store.addContribution({
        stationId,
        userId,
        mediaId: body.mediaId,
        replyToId: body.replyToId,
        durationMs: media.durationMs,
        transcript: media.transcript,
        day: this.deps.now().toISOString().slice(0, 10),
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505')
        throw conflict('One clip per person, station, and day');
      throw error;
    }
    return this.detail(showId, userId);
  }

  async branch(showId: string, stationId: string, userId: string, topic: string) {
    await this.accessible(showId, userId);
    const parent = (await this.deps.store.stations(showId)).find((item) => item.id === stationId);
    if (!parent) throw notFound('Podcast station not found');
    if (!parent.participantIds.includes(userId)) throw forbidden('Only station participants can branch');
    await this.deps.store.branch(showId, stationId, topic.trim(), parent.participantIds);
    return this.detail(showId, userId);
  }

  async wrap(showId: string, userId: string) {
    const show = await this.accessible(showId, userId);
    if (show.hostUserId !== userId) throw forbidden('Only the host can wrap the show');
    const stations = await this.deps.store.stations(showId);
    const contributions = await this.deps.store.contributions(stations.map((station) => station.id));
    const engaged = new Set(contributions.map((item) => item.userId));
    const missing = show.requiredParticipantIds.filter((id) => !engaged.has(id));
    if (missing.length)
      throw conflict(`Waiting for ${missing.length} required participant${missing.length === 1 ? '' : 's'}`);
    await this.deps.store.wrap(showId, this.deps.now());
    return this.detail(showId, userId);
  }

  async finish(showId: string, userId: string) {
    const show = await this.accessible(showId, userId);
    if (show.hostUserId !== userId) throw forbidden('Only the host can finish the show');
    const stations = await this.deps.store.stations(showId);
    const contributions = await this.deps.store.contributions(stations.map((station) => station.id));
    assertFinishable({
      wrapped: Boolean(show.wrappedAt),
      required: show.requiredParticipantIds,
      engaged: [...new Set(contributions.map((item) => item.userId))],
    });
    const audio = await this.deps.render(contributions);
    let mediaId: string | null = null;
    try {
      mediaId = (
        await this.deps.save(audio, {
          ownerUserId: userId,
          kind: 'audio',
          mime: 'audio/mpeg',
          durationMs: audioDuration(contributions.length),
        })
      ).id;
    } catch (error) {
      if (env.NODE_ENV === 'production') throw error;
    }
    await this.deps.store.finish(showId, mediaId);
    return this.detail(showId, userId);
  }

  async audio(showId: string, userId: string) {
    const show = await this.accessible(showId, userId);
    if (show.state !== 'finished') throw conflict('Finish the show before listening');
    const stations = await this.deps.store.stations(showId);
    return this.deps.render(await this.deps.store.contributions(stations.map((station) => station.id)));
  }
}

const audioDuration = (clips: number) => 1000 + clips * 20_000 + Math.max(0, clips - 1) * 300;
const service = new PodcastService();
export const createPodcast = service.create.bind(service);
export const getPodcast = service.detail.bind(service);
export const contributePodcast = service.contribute.bind(service);
export const branchPodcast = service.branch.bind(service);
export const wrapPodcast = service.wrap.bind(service);
export const finishPodcast = service.finish.bind(service);
export const podcastAudio = service.audio.bind(service);
