'use client';
import type { EventEnvelope, EventName } from '@lore/shared/events';
import { io, type Socket } from 'socket.io-client';

/** Single shared Socket.IO connection (same-origin /socket.io, session cookie auth). */
let socket: Socket | null = null;
const joined = new Map<string, number>();

export function getSocket(): Socket {
  if (!socket) {
    socket = io({ path: '/socket.io', withCredentials: true, transports: ['websocket', 'polling'] });
    socket.on('connect', () => {
      // re-join rooms after reconnect; screens backfill via REST on `reconnected`
      for (const room of joined.keys()) socket!.emit('room.join', { room });
      window.dispatchEvent(new CustomEvent('lore:socket-connected'));
    });
  }
  return socket;
}

export function joinRoom(room: string) {
  const s = getSocket();
  joined.set(room, (joined.get(room) ?? 0) + 1);
  if (s.connected) s.emit('room.join', { room });
  return () => {
    const n = (joined.get(room) ?? 1) - 1;
    if (n <= 0) {
      joined.delete(room);
      s.emit('room.leave', { room });
    } else joined.set(room, n);
  };
}

export function onEvent<E extends EventName>(type: E, handler: (env: EventEnvelope<E>) => void) {
  const s = getSocket();
  const h = (env: EventEnvelope<E>) => handler(env);
  s.on(type as string, h as any);
  return () => {
    s.off(type as string, h as any);
  };
}

export function sendTyping(conversationId: string, on: boolean) {
  getSocket().emit('typing.set', { conversationId, on });
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  joined.clear();
}
