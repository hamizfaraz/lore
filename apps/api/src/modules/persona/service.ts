import type { MessageDTO } from '@lore/shared/dto/chat';
import { NotImplemented } from '../../lib/errors';

/** persona business logic [C2]. */

/** Cross-boundary [C2 implements, C1 calls fire-and-forget after every human message insert]. */
export async function onMessage(_msg: MessageDTO): Promise<void> {
  throw new NotImplemented('persona.service.onMessage');
}
