import { readFile } from 'node:fs/promises';

import { z } from 'zod';

import { AiBudget, InMemoryCounterStore } from './budget.js';
import { embedTexts, GuardVerdictSchema } from './clients/gemini.js';
import { listMuseModels } from './clients/muse.js';
import { generateMuseImage } from './clients/museImage.js';
import { transcribeMuseBatch } from './clients/museVoice.js';
import { SerpClient } from './clients/serp.js';
import { getAiConfig } from './config.js';
import { getFiveWordChoices, getPrompts } from './games.js';
import { guardText } from './guard.js';
import { MOCK_FIXTURE_NAMES, getMockFixture } from './mocks/fixtures.js';
import { mockImages, mockVoiceFixtures } from './mocks/media.js';
import { callStructured } from './structured.js';

async function smokeMock(): Promise<Record<string, unknown>> {
  for (const name of MOCK_FIXTURE_NAMES) getMockFixture(name);
  const choices = await getFiveWordChoices({ story: ['Once'] });
  const prompts = await getPrompts({
    conversationId: 'smoke',
    mode: 'pictionary',
    contextSource: 'random',
    memories: [],
  });
  const guard = await guardText('friends planning a movie night');
  const budget = new AiBudget(new InMemoryCounterStore());
  const budgetDecision = await budget.consumeText('smoke');
  return {
    mode: 'mock',
    fixtures: MOCK_FIXTURE_NAMES.length,
    images: mockImages.length,
    voiceFixtures: mockVoiceFixtures.length,
    choices: choices.words.length,
    prompts: prompts.length,
    guard,
    budget: budgetDecision,
  };
}

async function smokeLive(): Promise<Record<string, unknown>> {
  const config = getAiConfig();
  const wavPath = process.env.AI_SMOKE_WAV_PATH?.trim();
  if (!wavPath) throw new Error('AI_SMOKE_WAV_PATH must point to a short spoken WAV for live smoke');

  const models = await listMuseModels(config);
  const structured = await callStructured(
    GuardVerdictSchema,
    [
      { role: 'system', content: 'Return a safety verdict as JSON.' },
      { role: 'user', content: 'friends planning a movie night' },
    ],
    { name: 'guardVerdict', config, timeoutMs: 8_000 },
  );
  if (structured.degraded) throw new Error(`Muse structured smoke degraded: ${structured.error}`);

  const image = await generateMuseImage({ prompt: 'a tiny warm paper-grain calendar icon' }, config);
  const transcript = await transcribeMuseBatch(
    { audio: await readFile(wavPath), sessionId: `smoke-${Date.now()}` },
    config,
  );
  const embeddings = await embedTexts(['friends planning a movie night'], config);
  const guard = await guardText('friends planning a movie night', config);
  const serp = await new SerpClient(undefined, config).events({
    q: 'events in Austin this weekend',
    extra: { htichips: 'date:weekend' },
  });

  return {
    mode: 'live',
    museModels: models.length,
    structured: structured.source,
    imageBytes: image.bytes.length,
    transcriptChars: transcript.text.length,
    embeddingDimensions: embeddings[0]?.length,
    guard,
    serpEngine: serp.engine,
  };
}

const config = getAiConfig();
const result = config.mode === 'live' ? await smokeLive() : await smokeMock();
z.record(z.string(), z.unknown()).parse(result);
console.log(JSON.stringify(result, null, 2));
