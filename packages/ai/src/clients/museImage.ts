import { toFile } from 'openai';

import { getAiConfig, type AiConfig } from '../config.js';
import { mockImages } from '../mocks/media.js';
import { getMuseClient } from './muse.js';

export interface MuseImageResult {
  bytes: Buffer;
  mime: 'image/png';
  model: string;
  revisedPrompt?: string;
}

export interface GenerateMuseImageOptions {
  prompt: string;
  size?: '256x256' | '512x512' | '1024x1024';
  user?: string;
}

export interface EditMuseImageOptions extends GenerateMuseImageOptions {
  images: Array<{ bytes: Buffer; filename: string; mime?: string }>;
}

function readImageResponse(
  response: { data?: Array<{ b64_json?: string; revised_prompt?: string }> },
  model: string,
): MuseImageResult {
  const image = response.data?.[0];
  if (!image?.b64_json) {
    throw new Error('Muse Image returned no base64 image');
  }

  return {
    bytes: Buffer.from(image.b64_json, 'base64'),
    mime: 'image/png',
    model,
    ...(image.revised_prompt ? { revisedPrompt: image.revised_prompt } : {}),
  };
}

export async function generateMuseImage(
  options: GenerateMuseImageOptions,
  config: AiConfig = getAiConfig(),
): Promise<MuseImageResult> {
  if (config.mode === 'mock') {
    return {
      bytes: Buffer.from(mockImages[0]!.bytes),
      mime: 'image/png',
      model: config.museImageModel,
    };
  }
  const response = await getMuseClient(config).images.generate({
    model: config.museImageModel,
    prompt: options.prompt,
    n: 1,
    response_format: 'b64_json',
    size: options.size ?? '1024x1024',
    ...(options.user ? { user: options.user } : {}),
  });
  return readImageResponse(response, config.museImageModel);
}

export async function editMuseImage(
  options: EditMuseImageOptions,
  config: AiConfig = getAiConfig(),
): Promise<MuseImageResult> {
  if (options.images.length === 0 || options.images.length > 4) {
    throw new Error('Muse Image edits require between 1 and 4 reference images');
  }
  if (config.mode === 'mock') {
    return {
      bytes: Buffer.from(mockImages[1]!.bytes),
      mime: 'image/png',
      model: config.museImageModel,
    };
  }

  const images = await Promise.all(
    options.images.map(({ bytes, filename, mime }) => toFile(bytes, filename, { type: mime ?? 'image/png' })),
  );
  const response = await getMuseClient(config).images.edit({
    model: config.museImageModel,
    image: images,
    prompt: options.prompt,
    n: 1,
    response_format: 'b64_json',
    size: options.size ?? '1024x1024',
    ...(options.user ? { user: options.user } : {}),
  });
  return readImageResponse(response, config.museImageModel);
}
