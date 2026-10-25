import { PutObjectCommand, S3Client } from '../apps/api/node_modules/@aws-sdk/client-s3/dist-cjs/index.js';
import { execFile } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const root = join(process.cwd(), '.data/media/demo/rich');
let videoEncoder: string | undefined;
const exists = async (path: string) =>
  stat(path)
    .then(() => true)
    .catch(() => false);

async function pickVideoEncoder() {
  if (videoEncoder) return videoEncoder;
  const { stdout } = await exec('ffmpeg', ['-hide_banner', '-encoders']);
  videoEncoder = ['libx264', 'libopenh264', 'mpeg4'].find((encoder) => stdout.includes(` ${encoder} `));
  if (!videoEncoder) throw new Error('ffmpeg needs an H.264 or MPEG-4 video encoder');
  return videoEncoder;
}

async function downloadPhoto(index: number) {
  const name = `photo-${String(index).padStart(2, '0')}.jpg`;
  const path = join(root, name);
  if (!(await exists(path))) {
    const response = await fetch(`https://picsum.photos/seed/lore-social-${index}/1080/1350`);
    if (!response.ok) throw new Error(`Photo ${index} failed with HTTP ${response.status}`);
    await writeFile(path, Buffer.from(await response.arrayBuffer()));
  }
  return { key: `demo/rich/${name}`, path, mime: 'image/jpeg' };
}

async function renderReel(index: number) {
  const name = `reel-${String(index).padStart(2, '0')}.mp4`;
  const path = join(root, name);
  if (!(await exists(path))) {
    const source = join(root, `photo-${String(index * 5).padStart(2, '0')}.jpg`);
    const encoder = await pickVideoEncoder();
    await exec('ffmpeg', [
      '-y',
      '-loop',
      '1',
      '-i',
      source,
      '-t',
      '6',
      '-vf',
      "scale=1080:1350:force_original_aspect_ratio=increase,crop=1080:1350,zoompan=z='min(zoom+0.0008,1.08)':d=180:s=1080x1350:fps=30,format=yuv420p",
      '-an',
      '-c:v',
      encoder,
      '-movflags',
      '+faststart',
      path,
    ]);
  }
  return { key: `demo/rich/${name}`, path, mime: 'video/mp4' };
}

async function main() {
  await mkdir(root, { recursive: true });
  const photos = [];
  for (let i = 1; i <= 48; i++) photos.push(await downloadPhoto(i));
  const reels = [];
  for (let i = 1; i <= 8; i++) reels.push(await renderReel(i));
  const assets = [...photos, ...reels];

  const configured = Boolean(
    process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY,
  );
  if (configured) {
    const client = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION ?? 'us-east-1',
      forcePathStyle: true,
      credentials: { accessKeyId: process.env.S3_ACCESS_KEY!, secretAccessKey: process.env.S3_SECRET_KEY! },
    });
    for (const asset of assets) {
      await client.send(
        new PutObjectCommand({
          Bucket: process.env.S3_BUCKET ?? 'lore-media',
          Key: asset.key,
          Body: await readFile(asset.path),
          ContentType: asset.mime,
        }),
      );
    }
  }
  console.log(
    JSON.stringify(
      {
        ok: true,
        localRoot: root,
        photos: photos.length,
        reels: reels.length,
        uploadedToObjectStorage: configured,
      },
      null,
      2,
    ),
  );
}

await main();
