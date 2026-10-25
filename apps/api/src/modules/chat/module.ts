import { rooms } from '@lore/shared/events';
import { defineModule } from '../../lib/module';
import { emit, registerClientHandler, registerRoomGuard } from '../../lib/socket';
import { jobs } from './jobs';
import routes from './routes';
import { membership } from './service';

export default defineModule({
  name: 'chat',
  owner: 'C1',
  routes,
  jobs,
  repeatables: [{ name: 'chat.expireGuests', everyMs: 10 * 60_000 }],
  setup: () => {
    registerRoomGuard('conv', async (userId, room) => Boolean(await membership(room.slice(5), userId)));
    registerClientHandler(
      'typing.set',
      async ({ userId, socketId }, data: { conversationId?: string; on?: boolean }) => {
        if (!data?.conversationId || !(await membership(data.conversationId, userId))) return;
        emit(
          rooms.conv(data.conversationId),
          'typing',
          { conversationId: data.conversationId, userId, on: Boolean(data.on) },
          { exceptSocketId: socketId },
        );
      },
    );
  },
});
