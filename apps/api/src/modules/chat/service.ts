import type { CardKind } from '@lore/shared/cards';
import type { MessageDTO } from '@lore/shared/dto/chat';
import type { MessageKind } from '@lore/shared/enums';
import type { Actor } from '../../lib/actor';
import { NotImplemented } from '../../lib/errors';

/** chat business logic [C1]. Cross-boundary functions below are called by C2 (section 6). */

export type PostMessageInput = {
  kind: MessageKind;
  body?: string | null;
  mediaIds?: string[];
  cardKind?: CardKind | null;
  cardRefId?: string | null;
  replyToId?: string | null;
  meta?: Record<string, unknown>;
  clientId?: string | null;
  /** for actor.type === 'ai' */
  personaId?: string | null;
};

export type MessagePatch = {
  body?: string | null;
  meta?: Record<string, unknown>;
  cardKind?: CardKind | null;
  cardRefId?: string | null;
  /** re-render the card payload for clients (card refresh) */
  refreshCard?: boolean;
};

/** Cross-boundary [C1 implements, C2 calls]: insert + emit `message.created`. AI actors set ai_generated. */
export async function postMessage(
  _convId: string,
  _input: PostMessageInput,
  _actor: Actor,
): Promise<MessageDTO> {
  throw new NotImplemented('chat.service.postMessage');
}

/** Cross-boundary [C1 implements, C2 calls]: patch + emit `message.updated` (transcripts, card refresh). */
export async function updateMessage(_id: string, _patch: MessagePatch): Promise<MessageDTO | null> {
  throw new NotImplemented('chat.service.updateMessage');
}
