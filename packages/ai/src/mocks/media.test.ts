import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { mockImages, mockVoiceFixtures } from './media.js';

describe('mock media fixtures', () => {
  it('provides six distinct, representative PNG illustrations', () => {
    expect(mockImages).toHaveLength(6);
    const hashes = mockImages.map(({ bytes }) => createHash('sha256').update(bytes).digest('hex'));
    expect(new Set(hashes)).toHaveLength(6);
    for (const { bytes } of mockImages) {
      expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      expect(bytes.readUInt32BE(16)).toBe(128);
      expect(bytes.readUInt32BE(20)).toBe(128);
    }
  });

  it('provides two non-silent spoken mono PCM16 WAV fixtures at 24 kHz', () => {
    expect(mockVoiceFixtures).toHaveLength(2);
    for (const fixture of mockVoiceFixtures) {
      expect(fixture.bytes.subarray(0, 4).toString('ascii')).toBe('RIFF');
      expect(fixture.bytes.subarray(8, 12).toString('ascii')).toBe('WAVE');
      expect(fixture.bytes.readUInt16LE(22)).toBe(1);
      expect(fixture.bytes.readUInt32LE(24)).toBe(24_000);
      expect(fixture.bytes.readUInt16LE(34)).toBe(16);
      expect(fixture.bytes.subarray(44).some((byte) => byte !== 0)).toBe(true);
    }
  });
});
