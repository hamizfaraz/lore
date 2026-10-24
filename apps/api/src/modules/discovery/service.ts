import { NotImplemented } from '../../lib/errors';

/** discovery business logic [C2]. */

export type SignalKind = 'like' | 'save' | 'share' | 'follow' | 'graph';

/** Cross-boundary [C2 implements, C1 calls on like/save/share/follow and Graph import]. */
export async function recordSignal(_userId: string, _tags: string[], _kind: SignalKind): Promise<void> {
  throw new NotImplemented('discovery.service.recordSignal');
}
