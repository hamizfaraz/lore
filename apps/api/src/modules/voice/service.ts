import { NotImplemented } from '../../lib/errors';

/** voice business logic [C2]. */

/** Cross-boundary [C2 implements, C1 calls]: queue/perform batch transcription of an audio media asset. */
export async function transcribeMedia(_mediaId: string): Promise<void> {
  throw new NotImplemented('voice.service.transcribeMedia');
}
