import { describe, expect, it } from 'vitest';

import { GuardVerdictSchema } from './clients/gemini.js';
import type { AiConfig } from './config.js';
import { callStructured } from './structured.js';

const LIVE_TEST_CONFIG: AiConfig = {
  mode: 'live',
  metaApiKey: 'test-only',
  metaApiBase: 'https://example.invalid/v1',
  museTextModel: 'muse-test',
  museImageModel: 'muse-image-test',
  museVoiceModel: 'muse-voice-test',
  geminiEmbedModel: 'gemini-embed-test',
};

describe('callStructured', () => {
  it('returns a validated fixture immediately in mock mode', async () => {
    const result = await callStructured(GuardVerdictSchema, [{ role: 'user', content: 'hello' }], {
      name: 'guardVerdict',
      config: { ...LIVE_TEST_CONFIG, mode: 'mock' },
    });

    expect(result).toMatchObject({ degraded: false, source: 'mock', attempts: 0 });
    expect(result.data).toEqual({ allow: true, category: 'ok', severity: 0 });
  });

  it('repairs one invalid response and accepts the second valid response', async () => {
    const calls: Array<unknown[]> = [];
    const result = await callStructured(GuardVerdictSchema, [{ role: 'user', content: 'hello' }], {
      name: 'guardVerdict',
      config: LIVE_TEST_CONFIG,
      executor: async (messages) => {
        calls.push(messages);
        if (calls.length === 1) return { nope: true };
        return { allow: true, category: 'ok', severity: 0 };
      },
    });

    expect(result).toMatchObject({ degraded: false, source: 'live', attempts: 2 });
    expect(calls[1]?.at(-1)).toMatchObject({ role: 'system' });
  });

  it('falls back to the mock fixture with degraded=true after one repair fails', async () => {
    let calls = 0;
    const result = await callStructured(GuardVerdictSchema, [{ role: 'user', content: 'hello' }], {
      name: 'guardVerdict',
      config: LIVE_TEST_CONFIG,
      executor: async () => {
        calls += 1;
        return { invalid: 'json shape' };
      },
    });

    expect(calls).toBe(2);
    expect(result).toMatchObject({ degraded: true, source: 'fallback', attempts: 2 });
    expect(result.data).toEqual({ allow: true, category: 'ok', severity: 0 });
    expect(result.error).toContain('Invalid input');
  });
});
