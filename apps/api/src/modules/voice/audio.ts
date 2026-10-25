import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execa } from 'execa';

export function wav24kArgs(input: string, output: string): string[] {
  return [
    '-nostdin',
    '-y',
    '-i',
    input,
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
    output,
  ];
}

/** Convert an uploaded voice note to Muse's authoritative 24 kHz mono PCM16 WAV input. */
export async function toWav24k(input: Buffer): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), 'lore-voice-'));
  const source = join(dir, 'source');
  const output = join(dir, 'voice.wav');
  try {
    await writeFile(source, input);
    await execa('ffmpeg', wav24kArgs(source, output));
    return await readFile(output);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
