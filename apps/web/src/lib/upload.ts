'use client';
import type { MediaDTO, PresignResponse } from '@lore/shared/dto/media';
import { api } from './api';

/** Compress (images ≤ 2048 px, 0.85), presign, PUT to object storage, then /complete (section 8.1). */
export async function uploadFile(
  file: File | Blob,
  kind: 'image' | 'video' | 'audio',
  opts: { onProgress?: (p: number) => void } = {},
): Promise<MediaDTO> {
  let blob: Blob = file;
  if (kind === 'image' && !(file.type === 'image/gif')) {
    const { default: compress } = await import('browser-image-compression');
    blob = await compress(file as File, {
      maxWidthOrHeight: 2048,
      initialQuality: 0.85,
      useWebWorker: true,
      fileType: 'image/jpeg',
    });
  }
  if (kind === 'video' && blob.size > 50 * 1024 * 1024) throw new Error('Videos are limited to 50 MB');
  const mime = blob.type || (kind === 'audio' ? 'audio/webm' : 'application/octet-stream');
  const presign = await api.post<PresignResponse>('/v1/media/presign', { kind, mime, bytes: blob.size });
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', presign.uploadUrl);
    for (const [k, v] of Object.entries(presign.headers)) xhr.setRequestHeader(k, v);
    xhr.withCredentials = presign.uploadUrl.startsWith('/');
    xhr.upload.onprogress = (e) => e.lengthComputable && opts.onProgress?.(e.loaded / e.total);
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error('Upload failed'));
    xhr.send(blob);
  });
  return api.post<MediaDTO>(`/v1/media/${presign.mediaId}/complete`, {});
}

export function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(v.src);
      resolve(v.duration);
    };
    v.onerror = () => resolve(0);
    v.src = URL.createObjectURL(file);
  });
}
