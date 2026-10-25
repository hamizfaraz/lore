export const HOUSE_IMAGE_STYLE =
  'HOUSE STYLE: warm editorial illustration, soft paper grain, gentle risograph texture, limited palette of coral, ink navy, cream and sage, friendly rounded shapes, generous negative space. No photorealistic faces of real people. No logos, brands, or copyrighted characters. No text unless the prompt asks for a short title.';

export function withHouseImageStyle(prompt: string): string {
  return `${HOUSE_IMAGE_STYLE}\n\nSUBJECT: ${prompt}`;
}
