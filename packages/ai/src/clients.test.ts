import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import type WebSocket from 'ws';

import { classifySafety, embedTexts } from './clients/gemini.js';
import { generateMuseImage } from './clients/museImage.js';
import { createMuseRealtimeSession, transcribeMuseBatch } from './clients/museVoice.js';
import { SerpClient } from './clients/serp.js';
import { getAiConfig } from './config.js';
import { mockVoiceFixtures } from './mocks/media.js';

const mockConfig = getAiConfig({ mode: 'mock' });

describe('mock provider clients', () => {
  it('returns deterministic 768-dimensional Gemini embeddings without a key', async () => {
    const [first, second] = await embedTexts(['same text', 'same text'], mockConfig);
    expect(first).toHaveLength(768);
    expect(first).toEqual(second);
    expect(await classifySafety('safe text', mockConfig)).toEqual({
      allow: true,
      category: 'ok',
      severity: 0,
    });
  });

  it('returns image and batch voice fixtures without network access', async () => {
    const image = await generateMuseImage({ prompt: 'mock image' }, mockConfig);
    expect(image.bytes.length).toBeGreaterThan(0);
    const transcript = await transcribeMuseBatch(
      { audio: mockVoiceFixtures[0]!.bytes, sessionId: 'mock' },
      mockConfig,
    );
    expect(transcript.text).toBe(mockVoiceFixtures[0]!.transcript);
  });

  it('emits a final realtime transcript when the mock stream ends', async () => {
    const onTranscript = vi.fn();
    const onClose = vi.fn();
    const session = createMuseRealtimeSession({ sessionId: 'mock-live', onTranscript, onClose }, mockConfig);
    expect(session.socket).toBeNull();
    session.sendPcm(Buffer.alloc(32));
    session.end();
    expect(onTranscript).toHaveBeenCalledWith(
      expect.objectContaining({ transcript: mockVoiceFixtures[0]!.transcript, final: true }),
    );
    expect(onClose).toHaveBeenCalledWith(1000, 'mock complete');
  });

  it('handshakes before flushing 24 kHz frames and ends the provider stream explicitly', () => {
    class FakeSocket extends EventEmitter {
      readyState = 1;
      sent: unknown[] = [];
      send(value: unknown) {
        this.sent.push(value);
      }
      close() {
        this.readyState = 3;
      }
    }
    const socket = new FakeSocket();
    let url = '';
    const session = createMuseRealtimeSession(
      {
        sessionId: 'session-1',
        keywords: ['Alex', 'Milo'],
        onTranscript: vi.fn(),
        socketFactory: (value) => {
          url = value;
          return socket as unknown as WebSocket;
        },
      },
      getAiConfig({
        mode: 'live',
        metaApiKey: 'server-only-key',
        metaApiBase: 'https://api.meta.test/v1',
        museVoiceModel: 'muse-voice-test',
      }),
    );
    const frame = Buffer.alloc(3_840, 1);
    session.sendPcm(frame);
    socket.emit('open');
    expect(JSON.parse(String(socket.sent[0]))).toEqual({
      authorization: { accessToken: 'Bearer server-only-key' },
      audioEncoding: 'PCM_24KHZ',
      model: 'muse-voice-test',
      mode: 'PUSH_TO_TALK',
      partialMode: 'CUMULATIVE',
      emitAudioProgress: false,
      keywords: ['Alex', 'Milo'],
    });
    expect(socket.sent).toHaveLength(1);
    socket.emit('message', Buffer.from(JSON.stringify({ sessionId: 'provider-session' })), false);
    expect(socket.sent[1]).toBe(frame);
    session.end();
    expect(JSON.parse(String(socket.sent[2]))).toEqual({ type: 'endStream' });
    expect(url).toBe('wss://api.meta.test/v1/asr/realtime?sessionId=session-1');
  });

  it('returns a source-shaped SerpAPI response without a key', async () => {
    const result = await new SerpClient(undefined, mockConfig).events({ q: 'Austin events' });
    expect(result).toMatchObject({ engine: 'google_events', cached: true });
    expect(result.raw.search_metadata).toMatchObject({ status: 'Success', mock: true });
  });

  it('accepts the ioredis cache shape used by the C1 runtime', async () => {
    const cache = {
      get: vi.fn(async () =>
        JSON.stringify({
          engine: 'google_events',
          query: 'Austin events',
          fetchedAt: new Date(0).toISOString(),
          degraded: false,
          raw: {},
        }),
      ),
      setex: vi.fn(async () => 'OK'),
    };
    const liveConfig = getAiConfig({ mode: 'live', serpApiKey: 'not-used-because-cache-hits' });
    const result = await new SerpClient(cache, liveConfig).events({ q: 'Austin events' });
    expect(result.cached).toBe(true);
    expect(cache.get).toHaveBeenCalledOnce();
    expect(cache.setex).not.toHaveBeenCalled();
  });
});
