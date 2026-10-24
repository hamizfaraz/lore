const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

export const mockImages = [
  'recap-cover.png',
  'story-ending.png',
  'meme-prompt.png',
  'meme-entry.png',
  'surprise.png',
  'podcast-broll.png',
].map((filename) => ({ filename, mime: 'image/png' as const, bytes: Buffer.from(PNG_1X1) }));

function makeSilentWav(durationMs: number, sampleRate = 24_000): Buffer {
  const samples = Math.ceil((durationMs / 1_000) * sampleRate);
  const dataBytes = samples * 2;
  const wav = Buffer.alloc(44 + dataBytes);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + dataBytes, 4);
  wav.write('WAVE', 8);
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(dataBytes, 40);
  return wav;
}

export const mockVoiceFixtures = [
  {
    filename: 'bringing-waffle-maker.wav',
    mime: 'audio/wav' as const,
    bytes: makeSilentWav(400),
    transcript: "i'm bringing the waffle maker",
  },
  {
    filename: 'movie-night.wav',
    mime: 'audio/wav' as const,
    bytes: makeSilentWav(400),
    transcript: 'movie night works for me after eight',
  },
];
