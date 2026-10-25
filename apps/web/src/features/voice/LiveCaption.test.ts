import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PcmFrameBuffer, liveVoiceUrl, pcm16le, resampleMono } from './LiveCaption';

describe('live caption browser audio', () => {
  it('resamples mono audio to 24 kHz and encodes little-endian PCM16', () => {
    const input = Float32Array.from({ length: 4_800 }, (_, index) => Math.sin(index / 10));
    const output = resampleMono(input, 48_000);
    expect(output).toHaveLength(2_400);
    const pcm = pcm16le(Float32Array.from([-1, 0, 1]));
    expect([...pcm]).toEqual([0, 128, 0, 0, 255, 127]);
  });

  it('emits only exact 3,840-byte frames and pads the final partial frame', () => {
    const frames = new PcmFrameBuffer();
    const first = frames.push(new Uint8Array(5_000));
    expect(first).toHaveLength(1);
    expect(first[0]).toHaveLength(3_840);
    expect(frames.flushPadded()).toHaveLength(3_840);
    expect(frames.flushPadded()).toBeNull();
  });

  it('uses only the same-origin proxy and contains no provider key or provider URL', () => {
    const location = { protocol: 'https:', host: 'ourlore.tech' } as Location;
    expect(liveVoiceUrl('conversation 1', location)).toBe(
      'wss://ourlore.tech/v1/voice/live?conversationId=conversation%201',
    );
    const source = readFileSync(new URL('./LiveCaption.tsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/META_API_KEY|accessToken|api\.meta\.ai/);
  });
});
