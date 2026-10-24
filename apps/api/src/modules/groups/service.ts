import type { DraftCardDTO } from '@lore/shared/dto/groups';
import type { PostKind, PostSourceKind } from '@lore/shared/enums';
import type { Actor } from '../../lib/actor';
import { NotImplemented } from '../../lib/errors';

/** groups business logic [C1]. */

export type CreateDraftInput = {
  accountId: string;
  conversationId: string;
  kind: PostKind;
  caption: string;
  mediaIds: string[];
  audioLabel?: string | null;
  source?: { kind: PostSourceKind; id?: string | null };
  /** AI drafts (recaps, game results, family stories) are always submitted, never published directly */
  createdByAi?: boolean;
  submit?: boolean;
};

/** Cross-boundary [C1 implements, C2 calls]: create a draft, post its draft_card to the chat. */
export async function createDraft(_input: CreateDraftInput, _actor: Actor): Promise<DraftCardDTO> {
  throw new NotImplemented('groups.service.createDraft');
}
