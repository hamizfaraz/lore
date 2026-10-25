import { describe, expect, it } from 'vitest';
import { assertGroundedFamilyStory } from './policy';

const source = {
  sourceMessageId: '00000000-0000-7000-8000-000000000001',
  contributorUserId: '00000000-0000-7000-8000-000000000002',
  text: 'Grandma taught us to make tea by smell.',
};

describe('family story grounding', () => {
  it('keeps every passage tied to a permitted source and contributor', () => {
    const spec = {
      title: 'Tea stories',
      periodLabel: 'October 2026',
      chapters: [{ heading: 'Tea', summary: 'A family ritual.', items: [source] }],
      flags: [],
      coverPrompt: 'a notebook and teacup',
    };
    expect(assertGroundedFamilyStory(spec, [source])).toEqual(spec);
  });

  it('rejects unknown source and contributor ids', () => {
    const spec = {
      title: 'Tea stories',
      periodLabel: 'October 2026',
      chapters: [
        {
          heading: 'Tea',
          summary: 'A family ritual.',
          items: [{ ...source, contributorUserId: '00000000-0000-7000-8000-000000000099' }],
        },
      ],
      flags: [],
      coverPrompt: 'a notebook and teacup',
    };
    expect(() => assertGroundedFamilyStory(spec, [source])).toThrow('unknown source or contributor');
  });

  it('rejects unsourced chapters', () => {
    expect(() =>
      assertGroundedFamilyStory(
        {
          title: 'Tea stories',
          periodLabel: 'October 2026',
          chapters: [{ heading: 'Tea', summary: 'A family ritual.', items: [] }],
          flags: [],
          coverPrompt: 'a notebook and teacup',
        },
        [source],
      ),
    ).toThrow('at least one source');
  });
});
