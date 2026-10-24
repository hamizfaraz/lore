import type { MediaDTO } from '@lore/shared/dto/media';
import type { MediaKind } from '@lore/shared/enums';
import { NotImplemented } from '../../lib/errors';

/** media business logic [C1]. */

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
export async function createFromBuffer(_buf: Buffer, _meta: CreateFromBufferMeta): Promise<MediaDTO> {
  throw new NotImplemented('media.service.createFromBuffer');
}

/** Cross-boundary [C1 implements, C2 calls]: 1-hour signed GET URL for a media asset. */
export async function signedUrl(_mediaId: string, _opts: { thumb?: boolean } = {}): Promise<string | null> {
  throw new NotImplemented('media.service.signedUrl');
}
