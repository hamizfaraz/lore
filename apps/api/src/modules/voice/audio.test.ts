import { mockVoiceFixtures } from '@lore/ai';
import { describe, expect, it } from 'vitest';
import { toWav24k, wav24kArgs } from './audio';

describe('voice audio conversion', () => {
  it('forces 24 kHz mono PCM16 WAV and strips metadata and chapters', () => {
    const args = wav24kArgs('/tmp/input.webm', '/tmp/output.wav');
    expect(args).toEqual([
      '-nostdin',
      '-y',
      '-i',
      '/tmp/input.webm',
      '-vn',
      '-ac',
      '1',
      '-ar',
      '24000',
      '-sample_fmt',
      's16',
      '-c:a',
      'pcm_s16le',
      '-map_metadata',
      '-1',
      '-map_chapters',
      '-1',
      '-fflags',
      '+bitexact',
      '-flags:a',
      '+bitexact',
      '/tmp/output.wav',
    ]);
  });

  it('produces a metadata-free mono 24 kHz PCM16 WAV', async () => {
    const wav = await toWav24k(mockVoiceFixtures[0]!.bytes);
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
    expect(wav.readUInt16LE(22)).toBe(1);
    expect(wav.readUInt32LE(24)).toBe(24_000);
    expect(wav.readUInt16LE(34)).toBe(16);
    expect(wav.includes(Buffer.from('LIST'))).toBe(false);
    expect(wav.includes(Buffer.from('ID3'))).toBe(false);
  });
});
