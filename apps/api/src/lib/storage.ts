import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './env';
import * as s3 from './s3';

/**
 * Object storage facade. Production: Vultr Object Storage via presigned PUT/GET (section 4).
 * Local dev without S3 credentials: files on disk under LOCAL_MEDIA_DIR, uploaded and served through
 * the api with HMAC-signed, expiring URLs (same flow as presigned S3, so the client code is identical).
 */
export const usingS3 = () => s3.s3Configured();

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const localRoot = () =>
  isAbsolute(env.LOCAL_MEDIA_DIR) ? env.LOCAL_MEDIA_DIR : join(repoRoot, env.LOCAL_MEDIA_DIR);

function localPath(key: string) {
  const p = normalize(join(localRoot(), key));
  if (!p.startsWith(localRoot())) throw new Error('bad key');
  return p;
}

export function sign(payload: string): string {
  return createHmac('sha256', env.BETTER_AUTH_SECRET).update(payload).digest('base64url');
}
export function verify(payload: string, sig: string): boolean {
  const a = Buffer.from(sign(payload));
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function presignPut(
  key: string,
  mime: string,
  expiresInSec = 300,
): Promise<{ url: string; headers: Record<string, string> }> {
  if (usingS3()) return s3.presignPut(key, mime, expiresInSec);
  const exp = Math.floor(Date.now() / 1000) + expiresInSec;
  const sig = sign(`put:${key}:${exp}`);
  return {
    url: `/v1/media/local/upload?key=${encodeURIComponent(key)}&exp=${exp}&sig=${sig}`,
    headers: { 'Content-Type': mime },
  };
}

export async function presignGet(key: string, expiresInSec = 3600): Promise<string> {
  if (usingS3()) return s3.presignGet(key, expiresInSec);
  // round expiry to the hour so URLs are cache-stable within a window
  const exp = (Math.floor(Date.now() / 1000 / 3600) + 2) * 3600;
  const sig = sign(`get:${key}:${exp}`);
  return `/v1/media/local/file?key=${encodeURIComponent(key)}&exp=${exp}&sig=${sig}`;
}

export async function putObject(key: string, body: Buffer, mime: string) {
  if (usingS3()) return s3.putObject(key, body, mime);
  const p = localPath(key);
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, body);
}

export async function getObject(key: string): Promise<Buffer> {
  if (usingS3()) return s3.getObject(key);
  return readFile(localPath(key));
}

export async function objectSize(key: string): Promise<number | null> {
  try {
    if (usingS3()) return (await s3.headObject(key)).ContentLength ?? null;
    return (await stat(localPath(key))).size;
  } catch {
    return null;
  }
}

export const local = { path: localPath };
