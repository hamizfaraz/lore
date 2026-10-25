import { execFileSync, spawnSync } from 'node:child_process';
import { copyFile, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artifactRoot = join(root, 'artifacts/demo-video');
const playwrightOutput = join(artifactRoot, 'playwright');
const databaseUrl = process.env.LORE_DEMO_DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5432/lore';

function assertLocalDatabase(url: string) {
  const target = new URL(url);
  if (!['127.0.0.1', 'localhost', '::1'].includes(target.hostname)) {
    throw new Error('Demo recording only resets a local database. Set LORE_DEMO_DATABASE_URL to localhost.');
  }
}

async function exists(path: string) {
  return stat(path)
    .then(() => true)
    .catch(() => false);
}

async function webms(path: string): Promise<string[]> {
  if (!(await exists(path))) return [];
  const items = await readdir(path, { withFileTypes: true });
  const nested = await Promise.all(
    items.map((item) => {
      const itemPath = join(path, item.name);
      return item.isDirectory()
        ? webms(itemPath)
        : Promise.resolve(itemPath.endsWith('.webm') ? [itemPath] : []);
    }),
  );
  return nested.flat();
}

function run(command: string, args: string[], env = process.env) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status ?? 'unknown'}`);
}

function chooseEncoder() {
  const encoders = execFileSync('ffmpeg', ['-hide_banner', '-encoders'], { encoding: 'utf8' });
  return ['libx264', 'libopenh264', 'mpeg4'].find((encoder) => encoders.includes(` ${encoder} `));
}

async function main() {
  assertLocalDatabase(databaseUrl);
  await rm(playwrightOutput, { recursive: true, force: true });
  await mkdir(artifactRoot, { recursive: true });

  if (!(await exists(join(root, '.data/media/demo/rich/photo-01.jpg')))) {
    console.log('\nPreparing local demo photos and reels…');
    run('pnpm', ['demo:media']);
  }

  console.log('\nResetting the local demo world…');
  run('pnpm', ['demo:reset', '--', `--database=${databaseUrl}`, '--confirm=lore-demo'], {
    ...process.env,
    DATABASE_URL: databaseUrl,
  });

  console.log('\nRecording the guided Playwright tour…');
  run('pnpm', ['exec', 'playwright', 'test', '-c', 'e2e/demo-video.config.ts'], {
    ...process.env,
    LORE_DEMO_DATABASE_URL: databaseUrl,
  });

  const recordings = await webms(playwrightOutput);
  if (!recordings.length) throw new Error('Playwright completed without producing a video.');
  const newest = (
    await Promise.all(recordings.map(async (path) => ({ path, at: (await stat(path)).mtimeMs })))
  ).sort((a, b) => b.at - a.at)[0].path;
  const webm = join(artifactRoot, 'lore-product-demo.webm');
  const mp4 = join(artifactRoot, 'lore-product-demo.mp4');
  await copyFile(newest, webm);

  const encoder = chooseEncoder();
  if (encoder) {
    console.log('\nCreating the shareable MP4…');
    run('ffmpeg', [
      '-y',
      '-i',
      webm,
      '-an',
      '-c:v',
      encoder,
      '-b:v',
      '5M',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      mp4,
    ]);
  }

  console.log(`\nDemo ready:\n  ${webm}${encoder ? `\n  ${mp4}` : ''}`);
}

await main();
