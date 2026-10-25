import { describe, expect, it } from 'vitest';
import { LIVE_VOICE_FRAME_BYTES, zLiveVoiceServerMessage, zTranscribeResult } from './voice';

describe('voice contracts', () => {
  it('keeps the exact 80 ms PCM16 frame size', () => {
    expect(LIVE_VOICE_FRAME_BYTES).toBe(24_000 * 0.08 * 2);
  });

  it('labels degraded batch results and attributes live transcripts to the authenticated uploader', () => {
    expect(
      zTranscribeResult.parse({ mediaId: 'media', transcript: 'hello', status: 'done', degraded: true }),
    ).toMatchObject({ degraded: true });
    expect(
      zLiveVoiceServerMessage.parse({
        type: 'transcript',
        text: 'hello',
        final: false,
        cumulative: true,
        speakerUserId: 'uploader',
      }),
    ).toMatchObject({ speakerUserId: 'uploader' });
  });
});
