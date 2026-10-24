import { describe, expect, it, vi } from 'vitest';

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

  it('returns a source-shaped SerpAPI response without a key', async () => {
    const result = await new SerpClient(undefined, mockConfig).events({ q: 'Austin events' });
    expect(result).toMatchObject({ engine: 'google_events', cached: true });
    expect(result.raw.search_metadata).toMatchObject({ status: 'Success', mock: true });
  });
});
