/**
 * Generates PWA icons, maskable icon, apple-touch-icon, badge, and iOS splash screens with sharp.
 * (Replaces pwa-asset-generator, which needs headless Chrome; output paths match app/layout.tsx.)
 */
import { mkdirSync } from 'node:fs';
import sharp from 'sharp';

const out = new URL('../public/', import.meta.url).pathname;
mkdirSync(`${out}icons`, { recursive: true });
mkdirSync(`${out}splash`, { recursive: true });

const mark = (size, { pad = 0.18, bg = true, radius = 0.22 } = {}) => {
  const r = size * radius;
  const fs = size * (1 - pad * 2) * 0.95;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs><linearGradient id="g" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#F6B94A"/><stop offset="0.6" stop-color="#FF5A4E"/><stop offset="1" stop-color="#E0457B"/></linearGradient></defs>
  ${bg ? `<rect width="${size}" height="${size}" rx="${r}" fill="url(#g)"/>` : ''}
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-weight="700" font-size="${fs}" fill="#FFFFFF">l</text>
</svg>`);
};

await sharp(mark(192)).png().toFile(`${out}icons/icon-192.png`);
await sharp(mark(512)).png().toFile(`${out}icons/icon-512.png`);
await sharp(mark(512, { pad: 0.28, radius: 0 }))
  .png()
  .toFile(`${out}icons/maskable-512.png`);
await sharp(mark(180, { radius: 0 }))
  .png()
  .toFile(`${out}icons/apple-touch-icon.png`);
await sharp(mark(72, { bg: false, pad: 0.1 }))
  .png()
  .toFile(`${out}icons/badge-72.png`);
await sharp(mark(32)).png().toFile(`${out}favicon.png`);

const splashes = [
  [1290, 2796],
  [1179, 2556],
  [1284, 2778],
  [1170, 2532],
  [1125, 2436],
  [828, 1792],
  [750, 1334],
];
for (const [w, h] of splashes) {
  const icon = await sharp(mark(Math.round(w * 0.22)))
    .png()
    .toBuffer();
  await sharp({ create: { width: w, height: h, channels: 4, background: '#FFFFFF' } })
    .composite([{ input: icon, gravity: 'center' }])
    .png()
    .toFile(`${out}splash/splash-${w}x${h}.png`);
}
console.log('icons + splash generated');
