import { deflateSync } from 'node:zlib';

import { SPOKEN_MOVIE_WAV, SPOKEN_WAFFLE_WAV } from './speech.js';

type Rgba = readonly [number, number, number, number];

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const PALETTES: ReadonlyArray<readonly [Rgba, Rgba, Rgba]> = [
  [
    [247, 239, 221, 255],
    [228, 112, 92, 255],
    [31, 48, 66, 255],
  ],
  [
    [244, 228, 215, 255],
    [109, 139, 116, 255],
    [34, 48, 65, 255],
  ],
  [
    [249, 242, 224, 255],
    [237, 151, 84, 255],
    [87, 109, 96, 255],
  ],
  [
    [238, 231, 219, 255],
    [201, 83, 88, 255],
    [45, 62, 78, 255],
  ],
  [
    [246, 235, 221, 255],
    [118, 151, 128, 255],
    [225, 116, 89, 255],
  ],
  [
    [244, 238, 224, 255],
    [40, 59, 76, 255],
    [222, 132, 103, 255],
  ],
];

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBytes = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([length, typeBytes, data, checksum]);
}

function mockIllustration(index: number, size = 128): Buffer {
  const palette = PALETTES[index % PALETTES.length]!;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const dx = x - size / 2;
      const dy = y - size / 2;
      const circle = dx * dx + dy * dy < (size * (0.18 + index * 0.01)) ** 2;
      const stripe = (x + y + index * 13) % (22 + index) < 7;
      const color = circle ? palette[2] : stripe ? palette[1] : palette[0];
      const offset = row + 1 + x * 4;
      raw[offset] = color[0];
      raw[offset + 1] = color[1];
      raw[offset + 2] = color[2];
      raw[offset + 3] = color[3];
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

export const mockImages = [
  'recap-cover.png',
  'story-ending.png',
  'meme-prompt.png',
  'meme-entry.png',
  'surprise.png',
  'podcast-broll.png',
].map((filename, index) => ({
  filename,
  mime: 'image/png' as const,
  bytes: mockIllustration(index),
}));

export const mockVoiceFixtures = [
  {
    filename: 'bringing-waffle-maker.wav',
    mime: 'audio/wav' as const,
    bytes: SPOKEN_WAFFLE_WAV,
    transcript: "i'm bringing the waffle maker",
  },
  {
    filename: 'movie-night.wav',
    mime: 'audio/wav' as const,
    bytes: SPOKEN_MOVIE_WAV,
    transcript: 'movie night works for me after eight',
  },
];
