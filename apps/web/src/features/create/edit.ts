/** Canvas helpers for the Create editor: crop (react-easy-crop area) + CSS filter baked into the export. */
export const FILTERS: { key: string; label: string; css: string }[] = [
  { key: 'normal', label: 'Normal', css: 'none' },
  { key: 'clarendon', label: 'Clarendon', css: 'contrast(1.2) saturate(1.35)' },
  { key: 'gingham', label: 'Gingham', css: 'brightness(1.05) hue-rotate(-10deg) sepia(0.04)' },
  { key: 'moon', label: 'Moon', css: 'grayscale(1) contrast(1.1) brightness(1.1)' },
  { key: 'lark', label: 'Lark', css: 'contrast(0.9) saturate(1.1) brightness(1.08)' },
  { key: 'juno', label: 'Juno', css: 'saturate(1.4) contrast(1.15) sepia(0.08)' },
  { key: 'riso', label: 'Riso', css: 'sepia(0.25) saturate(1.3) hue-rotate(-12deg) contrast(1.05)' },
];

export type Area = { x: number; y: number; width: number; height: number };

export async function renderEdited(src: string, area: Area | null, filterCss: string): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
  const a = area ?? { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight };
  const scale = Math.min(1, 2048 / Math.max(a.width, a.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(a.width * scale);
  canvas.height = Math.round(a.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.filter = filterCss;
  ctx.drawImage(img, a.x, a.y, a.width, a.height, 0, 0, canvas.width, canvas.height);
  return new Promise((res) => canvas.toBlob((b) => res(b!), 'image/jpeg', 0.88));
}
