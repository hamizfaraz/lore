import { readFileSync } from 'node:fs';

import {
  CommonGroundReason,
  FamilyStorySpec,
  FiveWordChoices,
  GamePrompt,
  GroupIntentBrief,
  GuardVerdict,
  MemeEntrySpec,
  PhotoNotes,
  PlanRanking,
  RecapDraftSpec,
  SpeakDecision,
} from '@lore/shared/ai';
import { z, type ZodType } from 'zod';

export const MOCK_FIXTURE_NAMES = [
  'speakDecision',
  'groupIntentBrief',
  'planRanking',
  'photoNotes',
  'recapDraftSpec',
  'fiveWordChoices',
  'gamePrompt',
  'memeEntrySpec',
  'familyStorySpec',
  'commonGroundReason',
  'guardVerdict',
] as const;

export type MockFixtureName = (typeof MOCK_FIXTURE_NAMES)[number];

const fixtureFiles: Record<MockFixtureName, string> = {
  speakDecision: 'speak-decision.json',
  groupIntentBrief: 'group-intent-brief.json',
  planRanking: 'plan-ranking.json',
  photoNotes: 'photo-notes.json',
  recapDraftSpec: 'recap-draft-spec.json',
  fiveWordChoices: 'five-word-choices.json',
  gamePrompt: 'game-prompt.json',
  memeEntrySpec: 'meme-entry-spec.json',
  familyStorySpec: 'family-story-spec.json',
  commonGroundReason: 'common-ground-reason.json',
  guardVerdict: 'guard-verdict.json',
};

const fixtureSchemas = {
  speakDecision: SpeakDecision,
  groupIntentBrief: GroupIntentBrief,
  planRanking: PlanRanking,
  photoNotes: z.array(PhotoNotes),
  recapDraftSpec: RecapDraftSpec,
  fiveWordChoices: FiveWordChoices,
  gamePrompt: GamePrompt,
  memeEntrySpec: MemeEntrySpec,
  familyStorySpec: FamilyStorySpec,
  commonGroundReason: CommonGroundReason,
  guardVerdict: GuardVerdict,
} satisfies Record<MockFixtureName, ZodType>;

export function getMockFixture(name: MockFixtureName): unknown {
  const source = readFileSync(new URL(`./fixtures/${fixtureFiles[name]}`, import.meta.url), 'utf8');
  return fixtureSchemas[name].parse(JSON.parse(source));
}
