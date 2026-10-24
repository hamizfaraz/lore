import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { zodResponseFormat } from 'openai/helpers/zod';
import type { ZodType } from 'zod';

import { getAiConfig, type AiConfig } from './config.js';
import { getMuseClient } from './clients/muse.js';
import { getMockFixture, type MockFixtureName } from './mocks/fixtures.js';

export type ReasoningEffort = 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

export interface StructuredCallOptions {
  name: MockFixtureName;
  model?: string;
  reasoningEffort?: ReasoningEffort;
  timeoutMs?: number;
  maxOutputTokens?: number;
  config?: AiConfig;
  mockValue?: unknown;
  executor?: (messages: ChatCompletionMessageParam[]) => Promise<unknown>;
}

export interface StructuredResult<T> {
  data: T;
  degraded: boolean;
  source: 'live' | 'mock' | 'fallback';
  attempts: number;
  model: string;
  error?: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRetryable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const status = (error as { status?: unknown }).status;
  return status === 429 || (typeof status === 'number' && status >= 500);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Structured AI call timed out after ${timeoutMs} ms`)),
      timeoutMs,
    );
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function validatedMock<T>(schema: ZodType<T>, options: StructuredCallOptions): T {
  const fixture = options.mockValue ?? getMockFixture(options.name);
  const parsed = schema.safeParse(fixture);
  if (!parsed.success) {
    throw new Error(`Mock fixture ${options.name} does not match its schema: ${parsed.error.message}`);
  }
  return parsed.data;
}

async function liveAttempt<T>(
  schema: ZodType<T>,
  messages: ChatCompletionMessageParam[],
  options: StructuredCallOptions,
  config: AiConfig,
): Promise<T> {
  if (options.executor) {
    return schema.parse(await options.executor(messages));
  }
  const request = getMuseClient(config).chat.completions.parse({
    model: options.model ?? config.museTextModel,
    messages,
    response_format: zodResponseFormat(schema, options.name),
    reasoning_effort: options.reasoningEffort ?? 'minimal',
    max_completion_tokens: options.maxOutputTokens,
  });
  const completion = await withTimeout(request, options.timeoutMs ?? 8_000);
  const message = completion.choices[0]?.message;
  if (!message?.parsed) {
    throw new Error(message?.refusal ?? 'Muse returned no schema-valid structured output');
  }
  return schema.parse(message.parsed);
}

export async function callStructured<T>(
  schema: ZodType<T>,
  messages: ChatCompletionMessageParam[],
  options: StructuredCallOptions,
): Promise<StructuredResult<T>> {
  const config = options.config ?? getAiConfig();
  const model = options.model ?? config.museTextModel;
  if (config.mode === 'mock') {
    return {
      data: validatedMock(schema, options),
      degraded: false,
      source: 'mock',
      attempts: 0,
      model,
    };
  }

  let attempts = 0;
  let lastError: unknown;
  let repairMessages = [...messages];
  for (let validationAttempt = 0; validationAttempt < 2; validationAttempt += 1) {
    for (const delayMs of [0, 500, 1_000, 2_000]) {
      if (delayMs) await sleep(delayMs);
      attempts += 1;
      try {
        const data = await liveAttempt(schema, repairMessages, options, config);
        return { data, degraded: false, source: 'live', attempts, model };
      } catch (error) {
        lastError = error;
        if (!isRetryable(error)) break;
      }
    }

    if (validationAttempt === 0) {
      repairMessages = [
        ...messages,
        {
          role: 'system',
          content: `Your previous output failed validation: ${errorMessage(lastError)}. Return only JSON matching the requested schema.`,
        },
      ];
    }
  }

  return {
    data: validatedMock(schema, options),
    degraded: true,
    source: 'fallback',
    attempts,
    model,
    error: errorMessage(lastError),
  };
}
