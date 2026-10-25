/**
 * Static map from Facebook Page categories to LORE interest tags (section 8.6).
 * Unknown categories are ignored. Several categories can share one tag.
 */
const CATEGORY_TAGS: Record<string, string> = {
  Movie: 'film-tv',
  'TV Show': 'film-tv',
  'TV Network': 'film-tv',
  'Movie Theater': 'film-tv',
  'Musician/Band': 'live-music',
  Music: 'live-music',
  'Concert Tour': 'live-music',
  'Concert Venue': 'live-music',
  'Record Label': 'live-music',
  Book: 'books',
  Author: 'books',
  'Book Series': 'books',
  Library: 'books',
  Artist: 'art',
  'Art Gallery': 'art',
  Museum: 'art',
  Photographer: 'photography',
  Restaurant: 'food',
  'Food & Beverage': 'food',
  Cafe: 'food',
  Bar: 'food',
  'Sports Team': 'sports',
  Athlete: 'sports',
  'Sports League': 'sports',
  'Video Game': 'gaming',
  'Games/Toys': 'gaming',
  'App Page': 'gaming',
  'Travel Company': 'travel',
  'Tour Agency': 'travel',
  Comedian: 'comedy',
  'Clothing (Brand)': 'fashion',
  'Gym/Physical Fitness Center': 'fitness',
  'Fitness Model': 'fitness',
  Pet: 'pets',
  University: 'campus',
  School: 'campus',
  Podcast: 'podcasts',
  'News Personality': 'news',
  'Media/News Company': 'news',
  'Outdoor & Sporting Goods Company': 'outdoors',
  Community: 'community',
};

const BY_LOWER = new Map(Object.entries(CATEGORY_TAGS).map(([k, v]) => [k.toLowerCase(), v]));

export function tagForCategory(category: string): string | null {
  return BY_LOWER.get(category.trim().toLowerCase()) ?? null;
}

export type LikeCategory = { category?: string | null };

/** Unique LORE tags, first-seen order, from a list of Facebook likes. */
export function tagsFromLikes(likes: LikeCategory[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const like of likes) {
    const tag = like.category ? tagForCategory(like.category) : null;
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}
