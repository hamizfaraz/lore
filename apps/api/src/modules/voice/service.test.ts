import { describe, expect, it, vi } from 'vitest';
import { createVoiceServiceForTest } from './service';
import type { VoiceMediaRecord } from './types';

const media = (overrides: Partial<VoiceMediaRecord> = {}): VoiceMediaRecord => ({
  id: 'media-1',
  ownerUserId: 'user-1',
  kind: 'audio',
  mime: 'audio/webm',
  transcript: null,
  transcriptStatus: 'pending',
  ...overrides,
});

function store(record = media()) {
  return {
    media: vi.fn(async () => record),
    messagesForMedia: vi.fn(async () => [
      { id: 'message-1', conversationId: 'conversation-1', senderUserId: 'user-1' },
    ]),
    setTranscript: vi.fn(async () => undefined),
    isConversationMember: vi.fn(async () => true),
    keywordsForConversation: vi.fn(async () => ['Alex', 'Milo']),
    audit: vi.fn(async () => undefined),
  };
}

describe('voice batch service', () => {
  it('queues idempotently and only lets the owner request a transcript', async () => {
    const saved = media({ transcript: 'already done', transcriptStatus: 'done' });
    const fakeStore = store(saved);
    const enqueue = vi.fn();
    const service = createVoiceServiceForTest({ store: fakeStore, enqueue });

    await expect(service.request(saved.id, 'someone-else')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(service.request(saved.id, 'user-1')).resolves.toEqual({
      mediaId: saved.id,
      transcript: 'already done',
      status: 'done',
      degraded: false,
    });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('converts, transcribes, persists, audits, and emits a message update', async () => {
    const fakeStore = store();
    const updateMessage = vi.fn(async () => null);
    const fetchAudio = vi.fn(async () => Buffer.from('original'));
    const convert = vi.fn(async () => Buffer.from('wav'));
    const transcribe = vi.fn(async () => ({
      text: '  movie night after eight  ',
      raw: {},
      model: 'muse-voice-test',
      degraded: true,
      source: 'fallback' as const,
    }));
    const service = createVoiceServiceForTest({
      store: fakeStore,
      signedUrl: async () => 'https://signed.test/voice',
      fetchAudio,
      convert,
      transcribe,
      updateMessage: updateMessage as never,
    });

    await expect(service.process('media-1')).resolves.toEqual({
      mediaId: 'media-1',
      transcript: 'movie night after eight',
      status: 'done',
      degraded: true,
    });
    expect(fetchAudio).toHaveBeenCalledWith('https://signed.test/voice');
    expect(convert).toHaveBeenCalledWith(Buffer.from('original'));
    expect(transcribe).toHaveBeenCalledWith(
      expect.objectContaining({
        audio: Buffer.from('wav'),
        filename: 'media-1.wav',
        keywords: ['Alex', 'Milo'],
      }),
    );
    expect(fakeStore.setTranscript).toHaveBeenCalledWith('media-1', 'movie night after eight', 'done');
    expect(updateMessage).toHaveBeenCalledWith(
      'message-1',
      expect.objectContaining({
        meta: expect.objectContaining({
          transcriptStatus: 'done',
          transcriptDegraded: true,
          transcriptSpeakerUserId: 'user-1',
        }),
      }),
    );
    expect(fakeStore.audit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'ok', degraded: true, source: 'fallback' }),
    );
  });

  it('marks a terminal failure without overwriting a completed transcript', async () => {
    const pendingStore = store();
    const updateMessage = vi.fn(async () => null);
    const service = createVoiceServiceForTest({ store: pendingStore, updateMessage: updateMessage as never });
    await service.markFailed('media-1', new Error('provider down'));
    expect(pendingStore.setTranscript).toHaveBeenCalledWith('media-1', null, 'failed');
    expect(updateMessage).toHaveBeenCalledWith(
      'message-1',
      expect.objectContaining({ meta: expect.objectContaining({ transcriptStatus: 'failed' }) }),
    );
    expect(pendingStore.audit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'error', detail: 'provider down' }),
    );

    const doneStore = store(media({ transcript: 'safe', transcriptStatus: 'done' }));
    const done = createVoiceServiceForTest({ store: doneStore });
    await done.markFailed('media-1', new Error('late retry'));
    expect(doneStore.setTranscript).not.toHaveBeenCalled();
  });
});
