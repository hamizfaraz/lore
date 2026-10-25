import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { generateMuseImage } from '../packages/ai/src/index';

if (process.env.AI_MODE !== 'live' || !process.argv.includes('--confirm-paid')) {
  throw new Error('Paid seed art generation requires AI_MODE=live and --confirm-paid');
}
const output = resolve(process.cwd(), 'scripts/assets/demo');
await mkdir(output, { recursive: true });
const prompts = [
  [
    'weekend-art.png',
    'LORE house-style editorial still life of an Austin weekend: picnic blanket, climbing shoes, warm sunset, no people or logos',
  ],
  [
    'family-art.png',
    'LORE house-style editorial still life of a handwritten recipe notebook, cardamom tea, and jasmine, no people or logos',
  ],
] as const;
for (const [filename, prompt] of prompts) {
  const image = await generateMuseImage({ prompt, size: '1024x1024' });
  if (image.degraded || image.source !== 'live')
    throw new Error(`${filename} did not receive a live Muse image`);
  await writeFile(resolve(output, filename), image.bytes);
}
console.log(`Wrote ${prompts.length} labeled seed illustrations to ${output}`);
