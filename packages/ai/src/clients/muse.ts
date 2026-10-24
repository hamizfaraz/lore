import OpenAI from 'openai';

import { getAiConfig, requireLiveValue, type AiConfig } from '../config.js';

let cachedClient: OpenAI | undefined;
let cachedSignature: string | undefined;

export function createMuseClient(config: AiConfig = getAiConfig()): OpenAI {
  return new OpenAI({
    apiKey: requireLiveValue(config.metaApiKey, 'META_API_KEY'),
    baseURL: config.metaApiBase,
    maxRetries: 0,
  });
}

export function getMuseClient(config: AiConfig = getAiConfig()): OpenAI {
  const signature = `${config.metaApiBase}:${config.metaApiKey ?? ''}`;
  if (!cachedClient || cachedSignature !== signature) {
    cachedClient = createMuseClient(config);
    cachedSignature = signature;
  }
  return cachedClient;
}

export async function listMuseModels(config: AiConfig = getAiConfig()): Promise<string[]> {
  const page = await getMuseClient(config).models.list();
  const models: string[] = [];
  for await (const model of page) {
    models.push(model.id);
  }
  return models;
}
