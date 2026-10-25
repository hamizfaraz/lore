import type { FamilyStorySpec } from '@lore/shared/ai';
import { badRequest } from '../../lib/errors';

export type GroundedSource = { sourceMessageId: string; contributorUserId: string; text: string };

/** Reject rather than silently laundering unknown model citations into a family archive. */
export function assertGroundedFamilyStory(spec: FamilyStorySpec, sources: GroundedSource[]): FamilyStorySpec {
  const permitted = new Map(sources.map((source) => [source.sourceMessageId, source]));
  for (const chapter of spec.chapters) {
    if (!chapter.items.length) throw badRequest('Every family story chapter needs at least one source');
    for (const item of chapter.items) {
      const source = permitted.get(item.sourceMessageId);
      if (!source || source.contributorUserId !== item.contributorUserId) {
        throw badRequest('Family story contained an unknown source or contributor');
      }
    }
  }
  for (const flag of spec.flags) {
    if (!permitted.has(flag.sourceMessageId))
      throw badRequest('Family story contained an unknown flag source');
  }
  return spec;
}
