import { z } from 'zod';
import { zContextSource, zGameMode, zGameState } from '../enums';

export const zGameConfig = z.object({
  rounds: z.number().int().min(1).max(10).default(3),
  timerSec: z.number().int().min(5).max(180).default(20),
  contextSource: zContextSource.default('hybrid'),
  teams: z.boolean().default(false),
  allowSelfVote: z.boolean().default(false),
  maxWords: z.number().int().min(6).max(60).default(24),
  aiCompetitor: z.boolean().default(true),
});
export type GameConfig = z.infer<typeof zGameConfig>;

export const zCreateGameBody = z.object({
  conversationId: z.string(),
  mode: zGameMode,
  config: zGameConfig.partial().default({}),
});
export type CreateGameBody = z.infer<typeof zCreateGameBody>;

export const zGameActionBody = z.object({
  type: z.enum([
    'choose_word',
    'submit_meme',
    'vote_meme',
    'guess',
    'stroke',
    'end',
    'next_round',
    'skip',
    'save_to_chat',
    'share_story',
    'propose_group',
  ]),
  payload: z.record(z.string(), z.unknown()).default({}),
});
export type GameActionBody = z.infer<typeof zGameActionBody>;

export const zGameParticipant = z.object({
  userId: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  team: z.string().nullable(),
  score: z.number(),
  ready: z.boolean(),
  color: z.string(),
});

export const zOneWordRound = z.object({
  mode: z.literal('one_word_story'),
  words: z.array(z.object({ word: z.string(), userId: z.string() })),
  activeUserId: z.string().nullable(),
  /** exactly five, only present for the active player */
  choices: z.array(z.string()).nullable(),
  deadline: z.string().nullable(),
  maxWords: z.number(),
  loreNotice: z.string().nullable(),
});

export const zMemeRound = z.object({
  mode: z.literal('meme_battle'),
  phase: z.enum(['submitting', 'voting', 'reveal']),
  prompt: z.object({
    kind: z.enum(['image', 'caption']),
    text: z.string().nullable(),
    imageUrl: z.string().nullable(),
    imageOptions: z.array(z.string()).nullable(),
  }),
  /** anonymous gallery while voting: no creator info until reveal */
  gallery: z.array(
    z.object({
      slot: z.number(),
      imageUrl: z.string().nullable(),
      caption: z.string(),
      creator: z
        .object({ type: z.enum(['human', 'ai']), userId: z.string().nullable(), displayName: z.string() })
        .nullable(),
      votes: z.number().nullable(),
    }),
  ),
  submittedCount: z.number(),
  votedCount: z.number(),
  mySubmitted: z.boolean(),
  myVoteSlot: z.number().nullable(),
  mySlot: z.number().nullable(),
  deadline: z.string().nullable(),
  loreNotice: z.string().nullable(),
});

export const zPictionaryRound = z.object({
  mode: z.literal('pictionary'),
  drawerUserId: z.string(),
  /** only for the drawer */
  prompt: z.string().nullable(),
  hintLength: z.number(),
  guesses: z.array(z.object({ userId: z.string(), text: z.string(), correct: z.boolean() })),
  solvedBy: z.array(z.string()),
  deadline: z.string().nullable(),
  loreNotice: z.string().nullable(),
});

export const zGameStateDTO = z.object({
  id: z.string(),
  conversationId: z.string(),
  mode: zGameMode,
  state: zGameState,
  config: zGameConfig,
  currentRound: z.number(),
  hostUserId: z.string(),
  participants: z.array(zGameParticipant),
  round: z.union([zOneWordRound, zMemeRound, zPictionaryRound]).nullable(),
  result: z
    .object({
      title: z.string().nullable(),
      text: z.string().nullable(),
      imageUrl: z.string().nullable(),
      winners: z.array(z.string()),
      words: z.array(z.object({ word: z.string(), userId: z.string() })).optional(),
    })
    .nullable(),
  youAreIn: z.boolean(),
  updatedAt: z.string(),
});
export type GameStateDTO = z.infer<typeof zGameStateDTO>;
