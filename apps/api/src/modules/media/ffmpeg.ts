import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execa } from 'execa';

/** ffmpeg/ffprobe via execa (static binary in the api image, section 4). Returns null when unavailable. */
async function withTemp<T>(buf: Buffer, fn: (path: string, dir: string) => Promise<T>): Promise<T | null> {
  const dir = await mkdtemp(join(tmpdir(), 'lore-'));
  const p = join(dir, 'in');
  try {
    await writeFile(p, buf);
    return await fn(p, dir);
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function probeMedia(buf: Buffer, _mime: string) {
  return withTemp(buf, async (p) => {
    const { stdout } = await execa('ffprobe', [
      '-v',
      'error',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      p,
    ]);
    const j = JSON.parse(stdout) as {
      format?: { duration?: string };
      streams?: { width?: number; height?: number }[];
    };
    const v = j.streams?.find((s) => s.width);
    return {
      durationMs: j.format?.duration ? Math.round(Number(j.format.duration) * 1000) : null,
      width: v?.width ?? null,
      height: v?.height ?? null,
    };
  });
}

export async function videoPoster(buf: Buffer): Promise<Buffer | null> {
  return withTemp(buf, async (p, dir) => {
    const out = join(dir, 'poster.jpg');
    await execa('ffmpeg', ['-y', '-ss', '0.5', '-i', p, '-frames:v', '1', '-q:v', '3', out]);
    return readFile(out);
  });
}

/** 24 kHz mono PCM16 WAV for Muse Voice Transcribe (section 7). Exposed for C2's voice module. */
export async function toWav24k(buf: Buffer): Promise<Buffer | null> {
  return withTemp(buf, async (p, dir) => {
    const out = join(dir, 'out.wav');
    await execa('ffmpeg', [
      '-y',
      '-i',
      p,
      '-ac',
      '1',
      '-ar',
      '24000',
      '-c:a',
      'pcm_s16le',
      '-map_metadata',
      '-1',
      out,
    ]);
    return readFile(out);
  });
}
