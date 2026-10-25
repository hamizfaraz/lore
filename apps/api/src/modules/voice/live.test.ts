import { EventEmitter } from 'node:events';
import type { MuseRealtimeOptions, MuseRealtimeSession } from '@lore/ai';
import { LIVE_VOICE_FRAME_BYTES } from '@lore/shared/dto/voice';
import { describe, expect, it, vi } from 'vitest';
import type { RawData } from 'ws';
import {
  authorizeVoiceUpgrade,
  normalizeLiveTranscript,
  originAllowed,
  startLiveVoiceSession,
  type LiveClientSocket,
} from './live';

const CONVERSATION_ID = '00000000-0000-4000-8000-000000000001';

class FakeClient extends EventEmitter implements LiveClientSocket {
  readyState = 1;
  sent: string[] = [];
  closed: Array<[number | undefined, string | undefined]> = [];

  send(data: string) {
    this.sent.push(data);
  }

  close(code?: number, reason?: string) {
    this.closed.push([code, reason]);
    this.readyState = 3;
    this.emit('close');
  }

  message(data: RawData, binary: boolean) {
    this.emit('message', data, binary);
  }
}

function harness() {
  let options: MuseRealtimeOptions | undefined;
  const provider: MuseRealtimeSession = {
    socket: null,
    sendPcm: vi.fn(),
    end: vi.fn(),
    close: vi.fn(),
  };
  const createProvider = vi.fn((input: MuseRealtimeOptions) => {
    options = input;
    return provider;
  });
  const timers = {
    setTimer: vi.fn(() => ({ fake: true }) as never),
    clearTimer: vi.fn(),
  };
  return {
    provider,
    createProvider,
    timers,
    get options() {
      return options!;
    },
  };
}

describe('voice live upgrade authorization', () => {
  const user = {
    id: 'user-1',
    email: 'user@example.test',
    name: 'Uploader',
    image: null,
    isGuest: false,
  };
  const metadata = {
    url: `/v1/voice/live?conversationId=${CONVERSATION_ID}`,
    origin: 'https://ourlore.tech',
    host: 'ourlore.tech',
    headers: {},
  };

  it('requires same-origin authentication and conversation membership', async () => {
    expect(originAllowed('https://ourlore.tech', 'ourlore.tech', 'https://ourlore.tech')).toBe(true);
    expect(originAllowed('https://evil.test', 'ourlore.tech', 'https://ourlore.tech')).toBe(false);

    await expect(
      authorizeVoiceUpgrade(metadata, {
        authenticate: async () => null,
        isMember: async () => true,
        appUrl: 'https://ourlore.tech',
      }),
    ).resolves.toMatchObject({ ok: false, status: 401 });
    await expect(
      authorizeVoiceUpgrade(metadata, {
        authenticate: async () => user,
        isMember: async () => false,
        appUrl: 'https://ourlore.tech',
      }),
    ).resolves.toMatchObject({ ok: false, status: 403 });
    await expect(
      authorizeVoiceUpgrade(metadata, {
        authenticate: async () => user,
        isMember: async () => true,
        appUrl: 'https://ourlore.tech',
      }),
    ).resolves.toMatchObject({ ok: true, user, conversationId: CONVERSATION_ID });
  });
});

describe('voice live session', () => {
  it('accepts exact 80 ms frames, ends cleanly, and rejects malformed frames', () => {
    const client = new FakeClient();
    const h = harness();
    startLiveVoiceSession(
      client,
      { userId: 'user-1', conversationId: CONVERSATION_ID, keywords: ['Alex'] },
      { createProvider: h.createProvider, ...h.timers },
    );
    client.message(Buffer.alloc(LIVE_VOICE_FRAME_BYTES), true);
    expect(h.provider.sendPcm).toHaveBeenCalledWith(expect.any(Buffer));
    client.message(Buffer.from(JSON.stringify({ type: 'end' })), false);
    expect(h.provider.end).toHaveBeenCalledOnce();

    const bad = new FakeClient();
    const badHarness = harness();
    startLiveVoiceSession(
      bad,
      { userId: 'user-1', conversationId: CONVERSATION_ID, keywords: [] },
      { createProvider: badHarness.createProvider, ...badHarness.timers },
    );
    bad.message(Buffer.alloc(12), true);
    expect(bad.sent.map((value) => JSON.parse(value))).toContainEqual(
      expect.objectContaining({ type: 'error', code: 'BAD_FRAME' }),
    );
    expect(bad.closed[0]?.[0]).toBe(1008);
  });

  it('relays cumulative partial/final transcripts with the authenticated uploader identity', () => {
    const client = new FakeClient();
    const h = harness();
    startLiveVoiceSession(
      client,
      { userId: 'authoritative-user', conversationId: CONVERSATION_ID, keywords: ['Milo'] },
      { createProvider: h.createProvider, ...h.timers },
    );
    h.options.onReady?.('provider-session');
    h.options.onTranscript({ transcript: 'movie', final: false, speaker: 'invented-provider-speaker' });
    h.options.onTranscript({ result: { text: 'movie night', isFinal: true } });
    expect(client.sent.map((value) => JSON.parse(value))).toEqual([
      { type: 'ready', sessionId: 'provider-session' },
      {
        type: 'transcript',
        text: 'movie',
        final: false,
        cumulative: true,
        speakerUserId: 'authoritative-user',
      },
      {
        type: 'transcript',
        text: 'movie night',
        final: true,
        cumulative: true,
        speakerUserId: 'authoritative-user',
      },
    ]);
    expect(normalizeLiveTranscript({ nonsense: true })).toBeNull();
  });

  it('closes the browser socket when the provider disconnects', () => {
    const client = new FakeClient();
    const h = harness();
    startLiveVoiceSession(
      client,
      { userId: 'user-1', conversationId: CONVERSATION_ID, keywords: [] },
      { createProvider: h.createProvider, ...h.timers },
    );
    h.options.onClose?.(1012, 'restart');
    expect(client.closed[0]).toEqual([1011, 'provider disconnected']);
  });
});
