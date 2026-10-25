import sharp from 'sharp';
import type { RecapLayout } from '@lore/shared/enums';

const WIDTH = 1080;
const HEIGHT = 1350;

async function tile(buffer: Buffer, width: number, height: number) {
  return sharp(buffer).rotate().resize(width, height, { fit: 'cover' }).jpeg({ quality: 88 }).toBuffer();
}

/** Deterministic 1080×1350 private recap render. No metadata or source bytes are preserved. */
export async function renderCollage(buffers: Buffer[], layout: RecapLayout): Promise<Buffer> {
  if (!buffers.length) throw new Error('At least one image is required');
  const canvas = sharp({ create: { width: WIDTH, height: HEIGHT, channels: 3, background: '#f5f1e8' } });
  if (layout === 'carousel') {
    return canvas
      .composite([{ input: await tile(buffers[0]!, WIDTH, HEIGHT), left: 0, top: 0 }])
      .jpeg({ quality: 90 })
      .toBuffer();
  }
  if (layout === 'collage') {
    const lead = await tile(buffers[0]!, 720, HEIGHT);
    const sideBuffers = buffers.slice(1, 4);
    const side = await Promise.all(
      (sideBuffers.length ? sideBuffers : [buffers[0]!]).map((buffer) =>
        tile(buffer, 360, Math.ceil(HEIGHT / Math.max(1, sideBuffers.length))),
      ),
    );
    return canvas
      .composite([
        { input: lead, left: 0, top: 0 },
        ...side.map((input, index) => ({ input, left: 720, top: index * Math.floor(HEIGHT / side.length) })),
      ])
      .jpeg({ quality: 90 })
      .toBuffer();
  }
  if (layout === 'story') {
    const selected = buffers.slice(0, 3);
    const images = await Promise.all(
      selected.map((buffer) => tile(buffer, WIDTH, Math.ceil(HEIGHT / selected.length))),
    );
    return canvas
      .composite(
        images.map((input, index) => ({ input, left: 0, top: index * Math.floor(HEIGHT / images.length) })),
      )
      .jpeg({ quality: 90 })
      .toBuffer();
  }
  const selected = buffers.slice(0, 4);
  const images = await Promise.all(selected.map((buffer) => tile(buffer, 540, 675)));
  return canvas
    .composite(
      images.map((input, index) => ({ input, left: (index % 2) * 540, top: Math.floor(index / 2) * 675 })),
    )
    .jpeg({ quality: 90 })
    .toBuffer();
}
