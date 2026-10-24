import type { Server as HttpServer } from 'node:http';
import { createAdapter } from '@socket.io/redis-adapter';
import { ClientSocketEvents, type EventData, type EventName, envelope, rooms } from '@lore/shared/events';
import { Server } from 'socket.io';
import { sessionFromHeaders } from './auth';
import { env } from './env';
import { logger } from './logger';
import { createRedis } from './redis';

/**
 * Socket.IO 4 + redis adapter (section 4). Auth via the Better Auth session cookie on handshake.
 * Rooms: user:{id}, conv:{id}, game:{id}, station:{id}. Server emits only; clients mutate via REST.
 * The worker/mcp processes create an emitter-only Server (no http) so emits fan out through Valkey.
 */
let io: Server | null = null;

/** Room-join authorization hooks; modules register checks for their room prefixes (conv:, game:, station:). */
type RoomGuard = (userId: string, room: string) => Promise<boolean>;
const roomGuards = new Map<string, RoomGuard>();
export function registerRoomGuard(prefix: string, guard: RoomGuard) {
  roomGuards.set(prefix, guard);
}

/** Client → server realtime handlers (typing, strokes) registered by modules. */
type ClientHandler = (ctx: { userId: string; socketId: string }, data: any) => Promise<void> | void;
const clientHandlers = new Map<string, ClientHandler>();
export function registerClientHandler(event: string, handler: ClientHandler) {
  clientHandlers.set(event, handler);
}

function withAdapter(server: Server) {
  try {
    const pub = createRedis();
    const sub = pub.duplicate();
    pub.on('error', (e) => logger.warn({ err: e.message }, 'socket redis pub error'));
    sub.on('error', (e) => logger.warn({ err: e.message }, 'socket redis sub error'));
    server.adapter(createAdapter(pub, sub));
  } catch (err) {
    logger.warn({ err }, 'socket.io redis adapter unavailable, using in-memory adapter');
  }
  return server;
}

export function initIo(http: HttpServer): Server {
  io = withAdapter(
    new Server(http, {
      path: '/socket.io',
      cors: { origin: [env.APP_URL], credentials: true },
      serveClient: false,
      connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000 },
    }),
  );

  io.use(async (socket, next) => {
    try {
      const user = await sessionFromHeaders(socket.handshake.headers as any);
      if (!user) return next(new Error('unauthorized'));
      socket.data.userId = user.id;
      next();
    } catch (err) {
      next(err as Error);
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId as string;
    socket.join(rooms.user(userId));

    socket.on('room.join', async (raw, ack?: (r: { ok: boolean }) => void) => {
      const parsed = ClientSocketEvents['room.join'].safeParse(raw);
      if (!parsed.success) return ack?.({ ok: false });
      const { room } = parsed.data;
      const guard = roomGuards.get(room.split(':')[0]);
      const allowed = guard ? await guard(userId, room).catch(() => false) : false;
      if (allowed) socket.join(room);
      ack?.({ ok: allowed });
    });
    socket.on('room.leave', (raw) => {
      const parsed = ClientSocketEvents['room.leave'].safeParse(raw);
      if (parsed.success) socket.leave(parsed.data.room);
    });
    for (const [event, handler] of clientHandlers) {
      socket.on(event, (data) => {
        Promise.resolve(handler({ userId, socketId: socket.id }, data)).catch((err) =>
          logger.warn({ err, event }, 'socket handler failed'),
        );
      });
    }
  });
  return io;
}

/** For worker/mcp: an io instance without an http server, used only to emit through the adapter. */
export function initEmitter(): Server {
  io ??= withAdapter(new Server());
  return io;
}

export function getIo(): Server | null {
  return io;
}

/** Emit a typed `{ type, at, data }` envelope to a room. No-op when no io exists (tests). */
export function emit<E extends EventName>(
  room: string,
  type: E,
  data: EventData<E>,
  opts: { exceptSocketId?: string } = {},
) {
  if (!io) return;
  const target = opts.exceptSocketId ? io.to(room).except(opts.exceptSocketId) : io.to(room);
  target.emit(type, envelope(type, data));
}

/** Remove every socket of a user from a room (e.g. removed member stops receiving events). */
export async function evictFromRoom(userId: string, room: string) {
  if (!io) return;
  await io.in(rooms.user(userId)).socketsLeave(room);
}
