import { describe, expect, it } from 'vitest';
import { zMemoryUpdateBody, zPersonaExplanationDTO, zPersonaMuteBody, zPersonaTestResponse } from './persona';

describe('persona DTO contracts', () => {
  it('accepts every supported mute duration', () => {
    for (const duration of ['one_hour', 'eight_hours', 'until_unmuted', 'unmute']) {
      expect(zPersonaMuteBody.safeParse({ duration }).success).toBe(true);
    }
  });

  it('requires an actual memory correction', () => {
    expect(zMemoryUpdateBody.safeParse({}).success).toBe(false);
    expect(zMemoryUpdateBody.parse({ summary: 'Prefers matinee movies' }).summary).toBe(
      'Prefers matinee movies',
    );
  });

  it('keeps previews and explanations bounded to disclosed fields', () => {
    expect(
      zPersonaTestResponse.parse({
        previews: [
          { message: 'movie night?', reason: 'the group asked for an idea' },
          { message: 'pizza could work too', reason: 'the group asked for a plan' },
          { message: 'Milo would stay quiet here.', reason: 'the group has it handled' },
        ],
        degraded: false,
      }).previews,
    ).toHaveLength(3);
    expect(
      zPersonaExplanationDTO.parse({
        reason: 'a relevant shared preference',
        memories: [{ id: 'memory-1', summary: 'The group likes comedies' }],
      }).memories[0]?.summary,
    ).toBe('The group likes comedies');
  });
});
