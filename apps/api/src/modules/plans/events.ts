import type { PlanCardDTO } from '@lore/shared/dto/plans';
import { rooms } from '@lore/shared/events';
import { emit } from '../../lib/socket';

export function emitPlanUpdated(plan: PlanCardDTO) {
  emit(rooms.conv(plan.conversationId), 'plan.updated', plan);
}
