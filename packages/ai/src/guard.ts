import { getAiConfig, type AiConfig } from './config.js';
import { classifySafety, GuardVerdictSchema, type GuardVerdict } from './clients/gemini.js';
import { getMockFixture } from './mocks/fixtures.js';

export interface GuardedResult<T> {
  value: T;
  verdict: GuardVerdict;
  allowed: boolean;
}

export async function guardText(text: string, config: AiConfig = getAiConfig()): Promise<GuardVerdict> {
  if (config.mode === 'mock') return GuardVerdictSchema.parse(getMockFixture('guardVerdict'));
  return classifySafety(text, config);
}

export async function guardGenerated<T>(
  value: T,
  toText: (value: T) => string,
  config: AiConfig = getAiConfig(),
): Promise<GuardedResult<T>> {
  const verdict = await guardText(toText(value), config);
  return { value, verdict, allowed: verdict.allow };
}

export async function generateWithInputGuard<T>(
  input: string,
  generate: () => Promise<T>,
  toOutputText: (value: T) => string,
  config: AiConfig = getAiConfig(),
): Promise<GuardedResult<T>> {
  const [inputVerdict, value] = await Promise.all([guardText(input, config), generate()]);
  if (!inputVerdict.allow) return { value, verdict: inputVerdict, allowed: false };
  return guardGenerated(value, toOutputText, config);
}
