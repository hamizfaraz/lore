import { and, eq, inArray } from '@lore/db';
import { mediaAssets } from '@lore/db';
import type { MediaDTO, PresignBody } from '@lore/shared/dto/media';
import type { MediaKind } from '@lore/shared/enums';
import { uuidv7 } from '@lore/shared/ids';
import { encode } from 'blurhash';
import sharp from 'sharp';
import { getDb } from '../../lib/db';
import { badRequest, forbidden, notFound } from '../../lib/errors';
import { logger } from '../../lib/logger';
import * as storage from '../../lib/storage';
import { probeMedia, videoPoster } from './ffmpeg';

/** media business logic [C1]: presign, complete (thumb, blurhash, dims), signed GETs, createFromBuffer. */

type MediaRow = typeof mediaAssets.$inferSelect;

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/avif': 'avif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
};
const extFor = (mime: string) => EXT[mime.split(';')[0].trim()] ?? 'bin';

const MAX_BYTES: Record<string, number> = {
  image: 20 * 1024 * 1024,
  video: 50 * 1024 * 1024,
  audio: 15 * 1024 * 1024,
};

export async function presign(userId: string, body: PresignBody) {
  const mime = body.mime.split(';')[0].trim();
  if (!mime.startsWith(`${body.kind}/`)) throw badRequest(`Expected a ${body.kind} file`);
  if (body.bytes > MAX_BYTES[body.kind]) throw badRequest('File is too large');
  const id = uuidv7();
  const key = `u/${userId}/${id}.${extFor(mime)}`;
  await getDb()
    .insert(mediaAssets)
    .values({ id, ownerUserId: userId, kind: body.kind, storageKey: key, mime, bytes: body.bytes });
  const put = await storage.presignPut(key, mime, 300);
  return { mediaId: id, uploadUrl: put.url, headers: put.headers };
}

async function imageDerivatives(buf: Buffer, ownerKey: string) {
  const img = sharp(buf, { failOn: 'none' }).rotate();
  const meta = await img.metadata();
  const portrait = (meta.orientation ?? 1) >= 5;
  const width = portrait ? meta.height : meta.width;
  const height = portrait ? meta.width : meta.height;
  const thumb = await img
    .clone()
    .resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();
  const { data, info } = await img
    .clone()
    .resize(32, 32, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const blurhash = encode(new Uint8ClampedArray(data), info.width, info.height, 4, 3);
  const thumbKey = ownerKey.replace(/\.[a-z0-9]+$/, '.thumb.webp');
  await storage.putObject(thumbKey, thumb, 'image/webp');
  return { width: width ?? null, height: height ?? null, blurhash, thumbKey };
}

/** POST /media/:id/complete — server reads the object, makes thumb/blurhash, queues transcription for audio. */
export async function complete(userId: string, mediaId: string): Promise<MediaDTO> {
  const db = getDb();
  const [row] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, mediaId)).limit(1);
  if (!row) throw notFound('Media not found');
  if (row.ownerUserId !== userId) throw forbidden();
  if (row.completedAt) return toDTO(row);
  const buf = await storage.getObject(row.storageKey).catch(() => null);
  if (!buf) throw badRequest('Upload not found; upload the file before completing');
  const patch: Partial<MediaRow> = { bytes: buf.length, completedAt: new Date() };
  try {
    if (row.kind === 'image') Object.assign(patch, await imageDerivatives(buf, row.storageKey));
    if (row.kind === 'video' || row.kind === 'audio') {
      const probe = await probeMedia(buf, row.mime);
      if (probe) {
        patch.durationMs = probe.durationMs;
        patch.width = probe.width;
        patch.height = probe.height;
      }
      if (row.kind === 'video') {
        if ((probe?.durationMs ?? 0) > 61_000) throw badRequest('Videos are limited to 60 seconds');
        const poster = await videoPoster(buf);
        if (poster) {
          const d = await imageDerivatives(poster, row.storageKey);
          patch.thumbKey = d.thumbKey;
          patch.blurhash = d.blurhash;
        }
      }
      if (row.kind === 'audio' || row.kind === 'video') patch.transcriptStatus = 'pending';
    }
  } catch (err) {
    if ((err as { code?: string }).code === 'BAD_REQUEST') throw err;
    logger.warn({ err, mediaId }, 'media derivative generation failed');
  }
  const [updated] = await db.update(mediaAssets).set(patch).where(eq(mediaAssets.id, mediaId)).returning();
  if (row.kind === 'audio' || row.kind === 'video') queueTranscription(mediaId);
  return toDTO(updated);
}

/** Voice notes: C2's voice.service.transcribeMedia (fire-and-forget; stub until C2 lands). */
export function queueTranscription(mediaId: string) {
  import('../voice/service')
    .then((v) => v.transcribeMedia(mediaId))
    .catch((err) => {
      if (err?.name === 'NotImplemented') return;
      logger.warn({ err: err?.message, mediaId }, 'transcribeMedia failed');
    });
}

export type CreateFromBufferMeta = {
  ownerUserId?: string | null;
  kind: MediaKind;
  mime: string;
  aiGenerated?: boolean;
  /** e.g. 'muse-image-1.0' */
  generator?: string | null;
  width?: number;
  height?: number;
  durationMs?: number;
  captionAi?: string | null;
};

/** Cross-boundary [C1 implements, C2 calls]: store bytes (Muse Image output, collage, render) as media. */
export async function createFromBuffer(buf: Buffer, meta: CreateFromBufferMeta): Promise<MediaDTO> {
  const id = uuidv7();
  const mime = meta.mime.split(';')[0].trim();
  const key = `${meta.ownerUserId ? `u/${meta.ownerUserId}` : 'sys'}/${id}.${extFor(mime)}`;
  await storage.putObject(key, buf, mime);
  const values: typeof mediaAssets.$inferInsert = {
    id,
    ownerUserId: meta.ownerUserId ?? null,
    kind: meta.kind,
    storageKey: key,
    mime,
    bytes: buf.length,
    width: meta.width ?? null,
    height: meta.height ?? null,
    durationMs: meta.durationMs ?? null,
    aiGenerated: meta.aiGenerated ?? meta.kind === 'generated_image',
    generator: meta.generator ?? null,
    captionAi: meta.captionAi ?? null,
    completedAt: new Date(),
  };
  if (mime.startsWith('image/')) {
    try {
      Object.assign(values, await imageDerivatives(buf, key));
    } catch (err) {
      logger.warn({ err }, 'createFromBuffer derivatives failed');
    }
  }
  const [row] = await getDb().insert(mediaAssets).values(values).returning();
  return toDTO(row);
}

/** Cross-boundary [C1 implements, C2 calls]: 1-hour signed GET URL for a media asset. */
export async function signedUrl(mediaId: string, opts: { thumb?: boolean } = {}): Promise<string | null> {
  const [row] = await getDb()
    .select({ storageKey: mediaAssets.storageKey, thumbKey: mediaAssets.thumbKey })
    .from(mediaAssets)
    .where(eq(mediaAssets.id, mediaId))
    .limit(1);
  if (!row) return null;
  return storage.presignGet(opts.thumb && row.thumbKey ? row.thumbKey : row.storageKey);
}

export async function toDTO(row: MediaRow, altText?: string | null): Promise<MediaDTO> {
  const [url, thumbUrl] = await Promise.all([
    storage.presignGet(row.storageKey),
    row.thumbKey ? storage.presignGet(row.thumbKey) : Promise.resolve(null),
  ]);
  return {
    id: row.id,
    kind: row.kind,
    url,
    thumbUrl,
    mime: row.mime,
    width: row.width,
    height: row.height,
    durationMs: row.durationMs,
    blurhash: row.blurhash,
    aiGenerated: row.aiGenerated,
    generator: row.generator,
    transcript: row.transcript,
    transcriptStatus: row.transcriptStatus,
    altText: altText ?? null,
  };
}

/** Batched DTOs preserving input order; unknown ids are skipped. */
export async function mediaDTOs(ids: string[], alt?: Map<string, string | null>): Promise<MediaDTO[]> {
  if (!ids.length) return [];
  const rows = await getDb()
    .select()
    .from(mediaAssets)
    .where(inArray(mediaAssets.id, [...new Set(ids)]));
  const byId = new Map(rows.map((r) => [r.id, r]));
  return Promise.all(ids.filter((id) => byId.has(id)).map((id) => toDTO(byId.get(id)!, alt?.get(id))));
}

export async function getRow(id: string) {
  const [row] = await getDb().select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
  return row ?? null;
}

/** Ensure every media id exists, is completed, and (unless allowAny) belongs to the user. */
export async function assertUsable(ids: string[], userId: string, opts: { allowAi?: boolean } = {}) {
  if (!ids.length) return [];
  const rows = await getDb().select().from(mediaAssets).where(inArray(mediaAssets.id, ids));
  if (rows.length !== new Set(ids).size) throw badRequest('Unknown media');
  for (const r of rows) {
    const ok = r.ownerUserId === userId || (opts.allowAi && r.ownerUserId === null);
    if (!ok) throw forbidden('You can only use your own media');
    if (!r.completedAt) throw badRequest('Media upload not completed');
  }
  return rows;
}

export async function suggestAltText(caption: string) {
  try {
    const ai = await import('@lore/ai');
    const { z } = await import('zod');
    const result = await ai.callStructured(
      z.object({ alt: z.string().max(180) }),
      [
        {
          role: 'system',
          content:
            'Write one short alt-text sentence for a photo. Do not guess health, race, religion, or politics.',
        },
        { role: 'user', content: caption.trim().slice(0, 500) || 'a photo shared on LORE' },
      ],
      { name: 'photoNotes', mockValue: { alt: '' }, maxOutputTokens: 80 },
    );
    return { alt: result.data.alt };
  } catch {
    return { alt: '' };
  }
}

export async function setTranscript(mediaId: string, transcript: string | null, status: 'done' | 'failed') {
  await getDb()
    .update(mediaAssets)
    .set({ transcript, transcriptStatus: status })
    .where(and(eq(mediaAssets.id, mediaId)));
}
