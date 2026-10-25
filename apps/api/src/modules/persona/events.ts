/** persona socket emits [C2]. Use `emit()` from lib/socket with event names from @lore/shared/events. */
import { emit } from '../../lib/socket';

export function emitPersonaTyping(conversationId: string, personaId: string, on: boolean): void {
  emit(`conv:${conversationId}`, 'ai.typing', { conversationId, personaId, on });
}
