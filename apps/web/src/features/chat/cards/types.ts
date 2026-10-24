import type { CardKind, CardPayload } from '@lore/shared/cards';
import type { MessageDTO } from '@lore/shared/dto/chat';

/** Props every chat card receives. `data` is the card payload (validated by @lore/shared/cards) or undefined while loading. */
export type CardProps<K extends CardKind = CardKind> = {
  message: MessageDTO;
  data: CardPayload<K> | undefined;
  conversationId: string;
  meUserId: string;
};
