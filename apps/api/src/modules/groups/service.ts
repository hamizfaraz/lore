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

/** POST /posts with a group author (section 8.1 step 3) — implemented in C1-5. */
export async function postFromComposer(
  _userId: string,
  _author: { id: string },
  _body: import('@lore/shared/dto/social').CreatePostBody,
): Promise<
  { type: 'post'; post: import('@lore/shared/dto/social').PostDTO } | { type: 'draft'; draftId: string }
> {
  throw new NotImplemented('groups.service.postFromComposer');
}

/** POST /stories with a group author: follows publishing_policies.story_mode — implemented in C1-5. */
export async function storyFromComposer(
  _userId: string,
  _author: { id: string },
  _body: { mediaId: string; caption?: string },
): Promise<{ type: 'story'; story: unknown } | { type: 'draft'; draftId: string }> {
  throw new NotImplemented('groups.service.storyFromComposer');
}
