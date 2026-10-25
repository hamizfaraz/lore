import { createHash } from 'node:crypto';

import { GoogleGenAI } from '@google/genai';
import { GuardVerdict as GuardVerdictSchema, type GuardVerdict } from '@lore/shared/ai';

import { getAiConfig, requireLiveValue, type AiConfig } from '../config.js';
import { getMockFixture } from '../mocks/fixtures.js';
import { isRetryableProviderError, withProviderBackoff } from '../retry.js';

export { GuardVerdictSchema };
export type { GuardVerdict };

let cachedClient: GoogleGenAI | undefined;
let cachedKey: string | undefined;

export function getGeminiClient(config: AiConfig = getAiConfig()): GoogleGenAI {
  const apiKey = requireLiveValue(config.geminiApiKey, 'GEMINI_API_KEY');
  if (!cachedClient || cachedKey !== apiKey) {
    cachedClient = new GoogleGenAI({ apiKey });
    cachedKey = apiKey;
  }
  return cachedClient;
}

function mockEmbeddings(texts: string[]): number[][] {
  return texts.map((text) => {
    const digest = createHash('sha256').update(text).digest();
    return Array.from({ length: 768 }, (_, index) => (digest[index % digest.length]! - 127.5) / 127.5);
  });
}

export async function embedTexts(texts: string[], config: AiConfig = getAiConfig()): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (config.mode === 'mock') return mockEmbeddings(texts);
  try {
    const response = await withProviderBackoff(() =>
      getGeminiClient(config).models.embedContent({
        model: config.geminiEmbedModel,
        contents: texts,
        config: { outputDimensionality: 768 },
      }),
    );
    const vectors = (response.embeddings ?? []).map((embedding) => embedding.values ?? []);
    if (vectors.length !== texts.length || vectors.some((vector) => vector.length !== 768)) {
      throw new Error('Gemini returned an invalid 768-dimensional embedding response');
    }
    return vectors;
  } catch (error) {
    if (!isRetryableProviderError(error)) throw error;
    return mockEmbeddings(texts);
  }
}

const GUARD_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['allow', 'category', 'severity'],
  properties: {
    allow: { type: 'boolean' },
    category: {
      type: 'string',
      enum: ['ok', 'harassment', 'sexual', 'self_harm', 'hate', 'private_info', 'humiliation'],
    },
    severity: { type: 'integer', enum: [0, 1, 2, 3] },
  },
};

export async function classifySafety(text: string, config: AiConfig = getAiConfig()): Promise<GuardVerdict> {
  if (config.mode === 'mock') return GuardVerdictSchema.parse(getMockFixture('guardVerdict'));
  const model = requireLiveValue(config.geminiGuardModel, 'GEMINI_GUARD_MODEL');
  try {
    const response = await withProviderBackoff(() =>
      getGeminiClient(config).models.generateContent({
        model,
        contents: [
          "Classify the supplied LORE social-app content for safety. Private information includes exposing another member's private preferences or private-chat content. Return JSON only.",
          `CONTENT:\n${text}`,
        ].join('\n\n'),
        config: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseJsonSchema: GUARD_JSON_SCHEMA,
        },
      }),
    );
    if (!response.text) throw new Error('Gemini guard returned no content');
    return GuardVerdictSchema.parse(JSON.parse(response.text));
  } catch (error) {
    if (!isRetryableProviderError(error)) throw error;
    return GuardVerdictSchema.parse(getMockFixture('guardVerdict'));
  }
}
