import { describe, expect, it } from 'vitest';
import { tagForCategory, tagsFromLikes } from './categories';

describe('graph category map', () => {
  it('maps the plan examples and collapses duplicates', () => {
    expect(tagForCategory('Movie')).toBe('film-tv');
    expect(tagForCategory('tv show')).toBe('film-tv');
    expect(tagForCategory('Musician/Band')).toBe('live-music');
    expect(
      tagsFromLikes([
        { category: 'Movie' },
        { category: 'TV Show' },
        { category: 'Musician/Band' },
        { category: 'Something LORE does not know' },
        { category: null },
      ]),
    ).toEqual(['film-tv', 'live-music']);
  });
});
