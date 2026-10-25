import type { IncomingHttpHeaders, IncomingMessage, Server as HttpServer } from 'node:http';
import type { Socket } from 'node:net';
import { createMuseRealtimeSession, type MuseRealtimeOptions, type MuseRealtimeSession } from '@lore/ai';
import {
  LIVE_VOICE_FRAME_BYTES,
  zLiveVoiceClientMessage,
  type LiveVoiceServerMessage,
} from '@lore/shared/dto/voice';
import { uuidv7 } from '@lore/shared/ids';
import { WebSocket, WebSocketServer, type RawData } from 'ws';
import { z } from 'zod';
import { sessionFromHeaders, type SessionUser } from '../../lib/auth';
import { env } from '../../lib/env';
import { logger } from '../../lib/logger';
import { voiceService } from './service';
import type { NormalizedLiveTranscript } from './types';

const LIVE_PATH = '/v1/voice/live';
const MAX_SESSION_MS = 65_000;
const conversationIdSchema = z.string().uuid();

export interface LiveClientSocket {
  readyState: number;
  on(event: 'message', listener: (data: RawData, isBinary: boolean) => void): this;
  on(event: 'close', listener: () => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

type LiveSessionDependencies = {
  createProvider: (options: MuseRealtimeOptions) => MuseRealtimeSession;
  setTimer: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimer: (timer: ReturnType<typeof setTimeout>) => void;
};

const liveDefaults: LiveSessionDependencies = {
  createProvider: (options) => createMuseRealtimeSession(options),
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (timer) => clearTimeout(timer),
};

export function normalizeLiveTranscript(payload: unknown): NormalizedLiveTranscript | null {
  if (!payload || typeof payload !== 'object') return null;
  const value = payload as Record<string, unknown>;
  const result =
    value.result && typeof value.result === 'object' ? (value.result as Record<string, unknown>) : {};
  const text = [value.transcript, value.text, result.transcript, result.text].find(
    (candidate): candidate is string => typeof candidate === 'string',
  );
  if (!text?.trim()) return null;
  const final =
    value.final === true || value.isFinal === true || result.final === true || result.isFinal === true;
  return { text: text.trim(), final };
}

function json(client: LiveClientSocket, message: LiveVoiceServerMessage) {
  if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(message));
}

/** Bind one authenticated browser socket to one server-side Muse Voice realtime session. */
export function startLiveVoiceSession(
  client: LiveClientSocket,
  context: { userId: string; conversationId: string; keywords: string[] },
  dependencies: Partial<LiveSessionDependencies> = {},
) {
  const deps = { ...liveDefaults, ...dependencies };
  let provider: MuseRealtimeSession | null = null;
  let disposed = false;

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    deps.clearTimer(timer);
    provider?.close();
  };
  const fail = (code: LiveVoiceServerMessage & { type: 'error' }) => {
    json(client, code);
    client.close(1011, code.message);
  };
  const timer = deps.setTimer(() => {
    json(client, {
      type: 'error',
      code: 'SESSION_LIMIT',
      message: 'Live captions stop after 65 seconds.',
    });
    provider?.end();
    client.close(1000, 'session limit');
  }, MAX_SESSION_MS);

  provider = deps.createProvider({
    sessionId: uuidv7(),
    keywords: context.keywords,
    onReady: (sessionId) => json(client, { type: 'ready', sessionId }),
    onTranscript: (payload) => {
      const transcript = normalizeLiveTranscript(payload);
      if (!transcript) return;
      json(client, {
        type: 'transcript',
        text: transcript.text,
        final: transcript.final,
        cumulative: true,
        speakerUserId: context.userId,
      });
    },
    onError: () =>
      fail({ type: 'error', code: 'PROVIDER_ERROR', message: 'Live captions are temporarily unavailable.' }),
    onClose: (code) => {
      if (client.readyState === WebSocket.OPEN)
        client.close(code === 1000 ? 1000 : 1011, code === 1000 ? 'complete' : 'provider disconnected');
    },
  });

  client.on('message', (raw, isBinary) => {
    if (isBinary) {
      const frame = Array.isArray(raw) ? Buffer.concat(raw) : Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
      if (frame.byteLength !== LIVE_VOICE_FRAME_BYTES) {
        json(client, {
          type: 'error',
          code: 'BAD_FRAME',
          message: `Audio frames must be exactly ${LIVE_VOICE_FRAME_BYTES} bytes.`,
        });
        client.close(1008, 'bad audio frame');
        return;
      }
      provider?.sendPcm(frame);
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.toString());
    } catch {
      parsed = null;
    }
    const message = zLiveVoiceClientMessage.safeParse(parsed);
    if (!message.success) {
      json(client, { type: 'error', code: 'BAD_MESSAGE', message: 'Unsupported live-caption message.' });
      client.close(1008, 'bad message');
      return;
    }
    provider?.end();
  });
  client.on('close', dispose);
  client.on('error', dispose);
  return { close: dispose };
}

export function originAllowed(
  origin: string | undefined,
  host: string | undefined,
  appUrl: string,
  development = false,
) {
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    if (development && (parsed.protocol === 'http:' || parsed.protocol === 'https:')) return true;
    return parsed.host === host || origin === appUrl;
  } catch {
    return false;
  }
}

type UpgradeMetadata = { url: string; origin?: string; host?: string; headers: IncomingHttpHeaders };
type UpgradeAuthorization =
  | { ok: true; user: SessionUser; conversationId: string }
  | { ok: false; status: 400 | 401 | 403; message: string };

export async function authorizeVoiceUpgrade(
  metadata: UpgradeMetadata,
  dependencies: {
    authenticate: (headers: IncomingHttpHeaders) => Promise<SessionUser | null>;
    isMember: (conversationId: string, userId: string) => Promise<boolean>;
    appUrl: string;
    development?: boolean;
  },
): Promise<UpgradeAuthorization> {
  if (!originAllowed(metadata.origin, metadata.host, dependencies.appUrl, dependencies.development))
    return { ok: false, status: 403, message: 'Origin not allowed' };
  const user = await dependencies.authenticate(metadata.headers).catch(() => null);
  if (!user) return { ok: false, status: 401, message: 'Sign in required' };
  const url = new URL(metadata.url, `http://${metadata.host ?? 'localhost'}`);
  const parsed = conversationIdSchema.safeParse(url.searchParams.get('conversationId'));
  if (!parsed.success) return { ok: false, status: 400, message: 'A valid conversationId is required' };
  if (!(await dependencies.isMember(parsed.data, user.id)))
    return { ok: false, status: 403, message: 'Conversation membership required' };
  return { ok: true, user, conversationId: parsed.data };
}

function rejectUpgrade(socket: Socket, status: number, message: string) {
  socket.write(
    `HTTP/1.1 ${status} ${message}\r\nConnection: close\r\nContent-Type: text/plain\r\nContent-Length: ${Buffer.byteLength(message)}\r\n\r\n${message}`,
  );
  socket.destroy();
}

/** Attach the authenticated raw WebSocket endpoint without exposing provider credentials. */
export function attachVoiceLiveProxy(http: HttpServer) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: LIVE_VOICE_FRAME_BYTES });
  const activeUsers = new Set<string>();
  http.on('upgrade', (request: IncomingMessage, socket: Socket, head: Buffer) => {
    const path = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`).pathname;
    if (path !== LIVE_PATH) return;
    void (async () => {
      const authorization = await authorizeVoiceUpgrade(
        {
          url: request.url ?? '/',
          origin: request.headers.origin,
          host: request.headers.host,
          headers: request.headers,
        },
        {
          authenticate: (headers) => sessionFromHeaders(headers),
          isMember: (conversationId, userId) => voiceService.isConversationMember(conversationId, userId),
          appUrl: env.APP_URL,
          development: env.NODE_ENV !== 'production',
        },
      );
      if (!authorization.ok) return rejectUpgrade(socket, authorization.status, authorization.message);
      if (activeUsers.has(authorization.user.id))
        return rejectUpgrade(socket, 429, 'A live-caption session is already active');
      activeUsers.add(authorization.user.id);
      const keywords = await voiceService
        .keywordsForConversation(authorization.conversationId)
        .catch(() => []);
      try {
        wss.handleUpgrade(request, socket, head, (client) => {
          const session = startLiveVoiceSession(client, {
            userId: authorization.user.id,
            conversationId: authorization.conversationId,
            keywords,
          });
          client.once('close', () => {
            session.close();
            activeUsers.delete(authorization.user.id);
          });
        });
      } catch (error) {
        activeUsers.delete(authorization.user.id);
        throw error;
      }
    })().catch((error) => {
      logger.warn({ err: error }, 'voice live upgrade failed');
      rejectUpgrade(socket, 500, 'Live captions unavailable');
    });
  });
}
