/** Feature flag names (env `FEATURE_*`, section 14). P1/P2 features ship dark when off. */
export const FLAGS = [
  'FEATURE_REELS',
  'FEATURE_EXPLORE',
  'FEATURE_GAMES_MEME',
  'FEATURE_GAMES_PICTIONARY',
  'FEATURE_FIND_FRIENDS',
  'FEATURE_FAMILY_STORY',
  'FEATURE_PODCAST',
  'FEATURE_IMPACT',
  'FEATURE_KEEPSAKES',
] as const;
export type Flag = (typeof FLAGS)[number];

export type FlagSet = Record<Flag, boolean>;

export function readFlags(env: Record<string, string | undefined>): FlagSet {
  return Object.fromEntries(FLAGS.map((f) => [f, env[f] === '1' || env[f] === 'true'])) as FlagSet;
}
