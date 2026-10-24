import { z } from 'zod';
import { zFamilyStoryCardDTO } from './dto/family';
import { zGameStateDTO } from './dto/games';
import { zDraftCardDTO } from './dto/groups';
import { zIntroductionDTO } from './dto/discovery';
import { zRecapCardDTO } from './dto/memories';
import { zAiImageCardDTO } from './dto/persona';
import { zPlanCardDTO, zPlanConfirmedCardDTO } from './dto/plans';
import { zPodcastInviteCardDTO } from './dto/podcast';
import { zPostDTO } from './dto/social';

/** Card kinds that can appear inside a chat message (`message.kind = 'card'`), section 6. */
export const CARD_KINDS = [
  'draft_card',
  'game_invite',
  'game_result',
  'post_share',
  'plan_card',
  'plan_confirmed',
  'recap_card',
  'family_story_card',
  'podcast_invite',
  'ai_image',
  'intro_card',
] as const;
export const zCardKind = z.enum(CARD_KINDS);
export type CardKind = z.infer<typeof zCardKind>;

export const CardPayloads = {
  draft_card: zDraftCardDTO,
  game_invite: zGameStateDTO,
  game_result: zGameStateDTO,
  post_share: zPostDTO,
  plan_card: zPlanCardDTO,
  plan_confirmed: zPlanConfirmedCardDTO,
  recap_card: zRecapCardDTO,
  family_story_card: zFamilyStoryCardDTO,
  podcast_invite: zPodcastInviteCardDTO,
  ai_image: zAiImageCardDTO,
  intro_card: zIntroductionDTO,
} as const satisfies Record<CardKind, z.ZodTypeAny>;

export type CardPayload<K extends CardKind> = z.infer<(typeof CardPayloads)[K]>;

/** Which computer owns rendering each card (for the registry and docs). */
export const CARD_OWNERS: Record<CardKind, 'C1' | 'C2'> = {
  draft_card: 'C1',
  game_invite: 'C1',
  game_result: 'C1',
  post_share: 'C1',
  plan_card: 'C2',
  plan_confirmed: 'C2',
  recap_card: 'C2',
  family_story_card: 'C2',
  podcast_invite: 'C2',
  ai_image: 'C2',
  intro_card: 'C2',
};
