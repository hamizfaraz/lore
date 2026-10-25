import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { renderCollage } from './collage';

describe('renderCollage', () => {
  it.each(['grid', 'collage', 'carousel', 'story'] as const)(
    'renders %s at 1080×1350 without source metadata',
    async (layout) => {
      const sources = await Promise.all(
        ['#d95f59', '#4d7f72', '#e2ad58', '#5478a8'].map((background, index) =>
          sharp({ create: { width: 120, height: 90, channels: 3, background } })
            .withMetadata({ exif: { IFD0: { ImageDescription: `private-${index}` } } })
            .jpeg()
            .toBuffer(),
        ),
      );
      const output = await renderCollage(sources, layout);
      const metadata = await sharp(output).metadata();
      expect(metadata.width).toBe(1080);
      expect(metadata.height).toBe(1350);
      expect(output.toString('utf8')).not.toContain('private-');
    },
  );
});
