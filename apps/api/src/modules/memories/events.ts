import type { RecapCardDTO } from '@lore/shared/dto/memories';
import { rooms } from '@lore/shared/events';
import { emit } from '../../lib/socket';

export function emitRecapUpdated(recap: RecapCardDTO) {
  emit(rooms.conv(recap.conversationId), 'recap.updated', recap);
}
