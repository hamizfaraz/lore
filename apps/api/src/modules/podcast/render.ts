import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execa } from 'execa';
import { signedUrl } from '../media/service';
import { env } from '../../lib/env';
import { NotImplemented } from '../../lib/errors';
import { renderTimeline } from './policy';

type RenderContribution = { id: string; userId: string; mediaId: string };

/**
 * C1 storage is the source of real audio after merge. The local mock build returns a small valid
 * MP3 timing proxy so the complete phone flow is testable without inventing a second media store.
 */
export async function renderPodcastAudio(contributions: RenderContribution[]): Promise<Buffer> {
  const timeline = renderTimeline(contributions);
  const urls = await Promise.all(contributions.map((item) => signedUrl(item.mediaId).catch(() => null)));
  if (urls.some(Boolean) && !urls.every(Boolean)) throw new NotImplemented('podcast source audio');
  if (!urls.every(Boolean) && env.NODE_ENV === 'production') throw new NotImplemented('podcast media render');
  const sourceBuffers = urls.every(Boolean)
    ? await Promise.all(
        urls.map(async (url) => {
          const response = await fetch(url!);
          if (!response.ok) throw new Error(`Podcast source download failed (${response.status})`);
          return Buffer.from(await response.arrayBuffer());
        }),
      )
    : null;
  return composeMp3(timeline, sourceBuffers);
}

async function composeMp3(timeline: ReturnType<typeof renderTimeline>, sourceBuffers: Buffer[] | null) {
  const dir = await mkdtemp(join(tmpdir(), 'lore-podcast-'));
  const output = join(dir, 'show.mp3');
  try {
    const args = ['-nostdin', '-y'];
    const filters: string[] = [];
    let clipIndex = 0;
    timeline.forEach((item, index) => {
      if (item.kind === 'clip' && sourceBuffers) {
        args.push('-i', join(dir, `clip-${clipIndex}.audio`));
        clipIndex += 1;
      } else if (item.kind === 'gap') {
        args.push('-f', 'lavfi', '-t', String(item.durationMs / 1000), '-i', 'anullsrc=r=44100:cl=mono');
      } else {
        const frequency = item.kind === 'tone' ? (item.label === 'intro' ? 660 : 520) : 330 + clipIndex * 35;
        args.push(
          '-f',
          'lavfi',
          '-t',
          String(item.durationMs / 1000),
          '-i',
          `sine=frequency=${frequency}:sample_rate=44100`,
        );
        if (item.kind === 'clip') clipIndex += 1;
      }
      filters.push(
        `[${index}:a]aresample=44100,aformat=channel_layouts=mono,atrim=duration=${item.durationMs / 1000}[a${index}]`,
      );
    });
    if (sourceBuffers) {
      await Promise.all(
        sourceBuffers.map((buffer, index) => writeFile(join(dir, `clip-${index}.audio`), buffer)),
      );
    }
    const labels = timeline.map((_, index) => `[a${index}]`).join('');
    args.push(
      '-filter_complex',
      `${filters.join(';')};${labels}concat=n=${timeline.length}:v=0:a=1[out]`,
      '-map',
      '[out]',
      '-c:a',
      'libmp3lame',
      '-b:a',
      '96k',
      '-map_metadata',
      '-1',
      output,
    );
    await execa('ffmpeg', args);
    return await readFile(output);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export type PodcastSlide = { speaker: string };

function frameLabel(value: string) {
  return (
    value
      .replace(/[\\%:'"]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 40) || 'LORE'
  );
}

/** Vertical MP4 after the MP3 exists. Each speaker gets a labeled frame. A missing ffmpeg leaves the audio episode. */
export async function renderPodcastVideo(
  audio: Buffer,
  title: string,
  slides: PodcastSlide[] = [],
): Promise<Buffer | null> {
  const dir = await mkdtemp(join(tmpdir(), 'lore-podcast-video-'));
  const audioPath = join(dir, 'show.mp3');
  const output = join(dir, 'show.mp4');
  const labels = (
    slides.length ? slides.map((slide) => frameLabel(slide.speaker)) : [frameLabel(title)]
  ).slice(0, 12);
  try {
    await writeFile(audioPath, audio);
    let duration = 4;
    try {
      const probed = await execa('ffprobe', [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'csv=p=0',
        audioPath,
      ]);
      const parsed = Number(probed.stdout.trim());
      if (Number.isFinite(parsed) && parsed > 0.5) duration = parsed;
    } catch {
      /* a short title card still matches the audio via -shortest */
    }
    const each = duration / labels.length;
    const draw = labels
      .map((label, index) => {
        const start = (index * each).toFixed(3);
        const end = ((index + 1) * each).toFixed(3);
        return `drawtext=text='${label}':fontcolor=white:fontsize=64:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t\\,${start}\\,${end})'`;
      })
      .join(',');
    const base = [
      '-nostdin',
      '-y',
      '-f',
      'lavfi',
      '-i',
      'color=c=0x1c1c1e:s=1080x1920:r=30',
      '-i',
      audioPath,
      '-shortest',
    ];
    try {
      await execa('ffmpeg', [
        ...base,
        '-vf',
        draw,
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        output,
      ]);
    } catch {
      await execa('ffmpeg', [...base, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', output]);
    }
    return await readFile(output);
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
