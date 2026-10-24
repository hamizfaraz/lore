import { z } from 'zod';
import { zConversationRow, zMessageDTO } from './dto/chat';
import { zFamilyStoryCardDTO } from './dto/family';
import { zGameStateDTO } from './dto/games';
import { zDraftCardDTO } from './dto/groups';
import { zIntroductionDTO } from './dto/discovery';
import { zRecapCardDTO } from './dto/memories';
import { zNotificationDTO } from './dto/notifications';
import { zPlanCardDTO } from './dto/plans';
import { zPodcastUpdateDTO } from './dto/podcast';

/** Socket event names and payloads (section 6). Server emits only; envelope `{ type, at, data }`. */
export const EventSchemas = {
  'message.created': zMessageDTO,
  'message.updated': z.object({ id: z.string(), conversationId: z.string(), patch: zMessageDTO.partial() }),
  typing: z.object({ conversationId: z.string(), userId: z.string(), on: z.boolean() }),
  'ai.typing': z.object({ conversationId: z.string(), personaId: z.string(), on: z.boolean() }),
  'conversation.updated': zConversationRow,
  'draft.updated': zDraftCardDTO,
  'post.published': z.object({ postId: z.string(), accountId: z.string() }),
  'game.state': zGameStateDTO,
  'game.stroke': z.object({
    gameId: z.string(),
    userId: z.string(),
    points: z.array(z.tuple([z.number(), z.number(), z.number()])),
    color: z.string(),
    size: z.number(),
  }),
  'plan.updated': zPlanCardDTO,
  'recap.updated': zRecapCardDTO,
  'family_story.updated': zFamilyStoryCardDTO,
  'podcast.updated': zPodcastUpdateDTO,
  'notification.created': zNotificationDTO,
  'intro.updated': zIntroductionDTO,
} as const;

export type EventName = keyof typeof EventSchemas;
export type EventData<E extends EventName> = z.infer<(typeof EventSchemas)[E]>;
export type EventEnvelope<E extends EventName = EventName> = { type: E; at: string; data: EventData<E> };
export const EVENT_NAMES = Object.keys(EventSchemas) as EventName[];

export const envelope = <E extends EventName>(type: E, data: EventData<E>): EventEnvelope<E> => ({
  type,
  at: new Date().toISOString(),
  data,
});

/** Room name helpers. */
export const rooms = {
  user: (id: string) => `user:${id}`,
  conv: (id: string) => `conv:${id}`,
  game: (id: string) => `game:${id}`,
  station: (id: string) => `station:${id}`,
} as const;

/** Client → server socket messages (join/leave rooms, typing, strokes). Mutations still go through REST. */
export const ClientSocketEvents = {
  'room.join': z.object({ room: z.string() }),
  'room.leave': z.object({ room: z.string() }),
  'typing.set': z.object({ conversationId: z.string(), on: z.boolean() }),
  'game.stroke': z.object({
    gameId: z.string(),
    points: z.array(z.tuple([z.number(), z.number(), z.number()])),
    color: z.string(),
    size: z.number(),
  }),
} as const;
export type ClientEventName = keyof typeof ClientSocketEvents;
