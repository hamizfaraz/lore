import WebSocket from 'ws';

import { getAiConfig, requireLiveValue, type AiConfig } from '../config.js';
import { mockVoiceFixtures } from '../mocks/media.js';
import { isRetryableProviderError, ProviderHttpError, withProviderBackoff } from '../retry.js';

export interface MuseTranscript {
  text: string;
  raw: unknown;
  model: string;
  degraded: boolean;
  source: 'live' | 'mock' | 'fallback';
}

export interface BatchTranscriptionOptions {
  audio: Buffer;
  sessionId: string;
  filename?: string;
  keywords?: string[];
}

function transcriptText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const value = payload as Record<string, unknown>;
  for (const key of ['transcript', 'text']) {
    if (typeof value[key] === 'string') return value[key];
  }
  const result = value.result;
  if (result && typeof result === 'object') {
    const nested = result as Record<string, unknown>;
    if (typeof nested.transcript === 'string') return nested.transcript;
    if (typeof nested.text === 'string') return nested.text;
  }
  return '';
}

export async function transcribeMuseBatch(
  options: BatchTranscriptionOptions,
  config: AiConfig = getAiConfig(),
): Promise<MuseTranscript> {
  if (config.mode === 'mock') {
    return {
      text: mockVoiceFixtures[0]!.transcript,
      raw: { transcript: mockVoiceFixtures[0]!.transcript, mock: true },
      model: config.museVoiceModel,
      degraded: false,
      source: 'mock',
    };
  }
  const apiKey = requireLiveValue(config.metaApiKey, 'META_API_KEY');
  const endpoint = new URL(`${config.metaApiBase.replace(/\/$/, '')}/asr/transcribe`);
  endpoint.searchParams.set('sessionId', options.sessionId);
  try {
    return await withProviderBackoff(async () => {
      const body = new FormData();
      body.append(
        'audio',
        new Blob([new Uint8Array(options.audio)], { type: 'audio/wav' }),
        options.filename ?? `${options.sessionId}.wav`,
      );
      body.append(
        'request',
        JSON.stringify({
          mode: 'PUSH_TO_TALK',
          model: config.museVoiceModel,
          audioEncoding: 'WAV',
          keywords: options.keywords ?? [],
        }),
      );
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body,
      });
      const raw = (await response.json().catch(() => ({}))) as unknown;
      if (!response.ok) {
        throw new ProviderHttpError(
          `Muse Voice batch transcription failed (${response.status})`,
          response.status,
        );
      }
      const text = transcriptText(raw);
      if (!text) throw new Error('Muse Voice returned no transcript');
      return {
        text,
        raw,
        model: config.museVoiceModel,
        degraded: false,
        source: 'live' as const,
      };
    });
  } catch (error) {
    if (!isRetryableProviderError(error)) throw error;
    return {
      text: mockVoiceFixtures[0]!.transcript,
      raw: { transcript: mockVoiceFixtures[0]!.transcript, fallback: true },
      model: config.museVoiceModel,
      degraded: true,
      source: 'fallback',
    };
  }
}

export interface MuseRealtimeOptions {
  sessionId: string;
  keywords?: string[];
  onTranscript: (payload: unknown) => void;
  onReady?: (sessionId: string) => void;
  onError?: (error: Error) => void;
  onClose?: (code: number, reason: string) => void;
  /** Test seam; production always uses the server-side `ws` client. */
  socketFactory?: (url: string) => WebSocket;
}

export interface MuseRealtimeSession {
  sendPcm(frame: Buffer | ArrayBuffer | Uint8Array): void;
  end(): void;
  close(): void;
  socket: WebSocket | null;
}

export function createMuseRealtimeSession(
  options: MuseRealtimeOptions,
  config: AiConfig = getAiConfig(),
): MuseRealtimeSession {
  if (config.mode === 'mock') {
    let ended = false;
    queueMicrotask(() => options.onReady?.(options.sessionId));
    return {
      socket: null,
      sendPcm() {},
      end() {
        if (ended) return;
        ended = true;
        options.onTranscript({
          type: 'transcript',
          transcript: mockVoiceFixtures[0]!.transcript,
          final: true,
          mock: true,
        });
        options.onClose?.(1000, 'mock complete');
      },
      close() {
        if (!ended) options.onClose?.(1000, 'mock closed');
        ended = true;
      },
    };
  }
  const apiKey = requireLiveValue(config.metaApiKey, 'META_API_KEY');
  const httpBase = new URL(config.metaApiBase);
  httpBase.protocol = httpBase.protocol === 'https:' ? 'wss:' : 'ws:';
  httpBase.pathname = `${httpBase.pathname.replace(/\/$/, '')}/asr/realtime`;
  httpBase.searchParams.set('sessionId', options.sessionId);

  const socket = options.socketFactory?.(httpBase.toString()) ?? new WebSocket(httpBase);
  let ready = false;
  let ended = false;
  const pending: Array<Buffer | ArrayBuffer | Uint8Array> = [];

  const sendFrame = (frame: Buffer | ArrayBuffer | Uint8Array) => {
    if (socket.readyState !== WebSocket.OPEN || !ready) {
      pending.push(frame);
      return;
    }
    socket.send(frame);
  };

  socket.on('open', () => {
    socket.send(
      JSON.stringify({
        authorization: { accessToken: `Bearer ${apiKey}` },
        audioEncoding: 'PCM_24KHZ',
        model: config.museVoiceModel,
        mode: 'PUSH_TO_TALK',
        partialMode: 'CUMULATIVE',
        emitAudioProgress: false,
        keywords: options.keywords ?? [],
      }),
    );
  });

  socket.on('message', (data, isBinary) => {
    if (isBinary) return;
    try {
      const payload = JSON.parse(data.toString()) as Record<string, unknown>;
      if (!ready && typeof payload.sessionId === 'string') {
        ready = true;
        options.onReady?.(payload.sessionId);
        for (const frame of pending.splice(0)) socket.send(frame);
        if (ended) socket.send(JSON.stringify({ type: 'endStream' }));
      }
      if ('transcript' in payload || payload.type === 'transcript') options.onTranscript(payload);
    } catch (error) {
      options.onError?.(error instanceof Error ? error : new Error('Invalid Muse Voice message'));
    }
  });
  socket.on('error', (error) => options.onError?.(error));
  socket.on('close', (code, reason) => options.onClose?.(code, reason.toString()));

  return {
    socket,
    sendPcm: sendFrame,
    end() {
      if (ended) return;
      ended = true;
      if (socket.readyState === WebSocket.OPEN && ready) socket.send(JSON.stringify({ type: 'endStream' }));
    },
    close() {
      socket.close();
    },
  };
}
