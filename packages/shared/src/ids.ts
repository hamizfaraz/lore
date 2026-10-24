import { uuidv7 } from 'uuidv7';
import { z } from 'zod';

export { uuidv7 };

declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type UserId = Brand<string, 'UserId'>;
export type AccountId = Brand<string, 'AccountId'>;
export type ConversationId = Brand<string, 'ConversationId'>;
export type MessageId = Brand<string, 'MessageId'>;
export type MediaId = Brand<string, 'MediaId'>;
export type PostId = Brand<string, 'PostId'>;
export type StoryId = Brand<string, 'StoryId'>;
export type DraftId = Brand<string, 'DraftId'>;
export type GameId = Brand<string, 'GameId'>;
export type PersonaId = Brand<string, 'PersonaId'>;
export type ProposalId = Brand<string, 'ProposalId'>;
export type CandidateId = Brand<string, 'CandidateId'>;
export type RecapId = Brand<string, 'RecapId'>;
export type MemoryId = Brand<string, 'MemoryId'>;
export type ShowId = Brand<string, 'ShowId'>;
export type StationId = Brand<string, 'StationId'>;

/** Zod schema for any app id (UUIDv7, but accepts any RFC 4122 uuid so seeded/fixture ids validate). */
export const zId = z.string().uuid();

export const newId = (): string => uuidv7();
