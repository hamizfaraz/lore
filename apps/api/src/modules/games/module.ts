import { rooms } from '@lore/shared/events';
import { defineModule } from '../../lib/module';
import { emit, registerClientHandler, registerRoomGuard } from '../../lib/socket';
import { registerCardResolver } from '../chat/service';
import { jobs } from './jobs';
import routes from './routes';
import { isParticipantOrMember, load, view } from './service';

export default defineModule({
  name: 'games',
  owner: 'C1',
  routes,
  jobs,
  repeatables: [{ name: 'games.sweep', everyMs: 60_000 }],
  setup: () => {
    const resolve = async (refId: string, ctx: { viewerUserId: string | null }) =>
      ctx.viewerUserId ? view(refId, ctx.viewerUserId) : undefined;
    registerCardResolver('game_invite', resolve);
    registerCardResolver('game_result', resolve);
    registerRoomGuard('game', (userId, room) => isParticipantOrMember(room.slice(5), userId));
    // Pictionary strokes: streamed to the game room (throttled client-side to 30 Hz), never persisted.
    registerClientHandler(
      'game.stroke',
      async (
        { userId, socketId },
        data: { gameId?: string; points?: [number, number, number][]; color?: string; size?: number },
      ) => {
        if (!data?.gameId || !Array.isArray(data.points)) return;
        const g = await load(data.gameId).catch(() => null);
        if (!g || g.mode !== 'pictionary' || g.pict?.drawerUserId !== userId || g.state !== 'active_round')
          return;
        emit(
          rooms.game(g.id),
          'game.stroke',
          {
            gameId: g.id,
            userId,
            points: data.points.slice(0, 200),
            color: String(data.color ?? '#000'),
            size: Number(data.size ?? 4),
          },
          { exceptSocketId: socketId },
        );
      },
    );
  },
});
