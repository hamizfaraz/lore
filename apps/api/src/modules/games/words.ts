/** Local fallbacks used when @lore/ai is unavailable (mock mode before C2 lands, or a degraded call). */
export const STORY_WORDS = {
  start: [
    'Once',
    'Yesterday',
    'Somehow',
    'Suddenly',
    'Tonight',
    'Gerald',
    'Everyone',
    'Nobody',
    'Milo',
    'The',
  ],
  noun: [
    'cactus',
    'waffle',
    'kayak',
    'dragon',
    'pizza',
    'robot',
    'moon',
    'party',
    'karaoke',
    'goose',
    'library',
    'taco',
    'disco',
    'umbrella',
    'bus',
    'cat',
    'castle',
    'saxophone',
  ],
  verb: [
    'danced',
    'sang',
    'tripped',
    'whispered',
    'exploded',
    'ran',
    'baked',
    'floated',
    'argued',
    'sneezed',
    'won',
    'vanished',
    'cried',
    'laughed',
    'paddled',
  ],
  adj: [
    'tiny',
    'glorious',
    'sleepy',
    'suspicious',
    'enormous',
    'sparkly',
    'grumpy',
    'legendary',
    'soggy',
    'chaotic',
    'cozy',
    'haunted',
  ],
  glue: [
    'and',
    'then',
    'with',
    'because',
    'but',
    'while',
    'into',
    'under',
    'at',
    'until',
    'so',
    'the',
    'a',
    'every',
  ],
};

export const RANDOM_PROMPTS = {
  pictionary: [
    'a cactus wearing sunglasses',
    'kayak race',
    'waffle tower',
    'haunted library',
    'karaoke night',
    'moon picnic',
    'robot chef',
    'goose on a bus',
    'disco umbrella',
    'pizza volcano',
  ],
  meme_battle: [
    'When the group chat plans something and nobody shows up',
    'Me pretending I read the book for book club',
    'The face you make when someone says "quick question"',
    'When Milo suggests a plan before anyone asks',
    'Monday me vs. Friday me',
    'When the waffle maker comes out at 3 a.m.',
  ],
  one_word_story: [
    'Start a story about the weekend',
    'Start a story about a legendary snack',
    'Start a story about a mysterious noise',
  ],
};

export function pick<T>(xs: T[], rng = Math.random): T {
  return xs[Math.floor(rng() * xs.length)];
}

/** Five distinct single words, none equal to the story's last word. */
export function localFiveWords(story: string[], rng = Math.random): string[] {
  const last = story[story.length - 1]?.toLowerCase();
  const pools =
    story.length === 0
      ? [STORY_WORDS.start, STORY_WORDS.start, STORY_WORDS.noun, STORY_WORDS.adj, STORY_WORDS.start]
      : [STORY_WORDS.noun, STORY_WORDS.verb, STORY_WORDS.adj, STORY_WORDS.glue, STORY_WORDS.glue];
  const out: string[] = [];
  let guard = 0;
  while (out.length < 5 && guard++ < 200) {
    const pool = pools[out.length % pools.length];
    const w = pick(pool, rng);
    if (w.toLowerCase() !== last && !out.some((x) => x.toLowerCase() === w.toLowerCase())) out.push(w);
  }
  return out;
}
