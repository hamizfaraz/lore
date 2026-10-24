/** Client feature flags (NEXT_PUBLIC_FEATURE_* mirror the server FEATURE_* env, section 14). */
const on = (v: string | undefined, d = false) => (v === undefined ? d : v === '1' || v === 'true');
export const clientFlags = {
  reels: on(process.env.NEXT_PUBLIC_FEATURE_REELS, true),
  explore: on(process.env.NEXT_PUBLIC_FEATURE_EXPLORE, true),
  gamesMeme: on(process.env.NEXT_PUBLIC_FEATURE_GAMES_MEME),
  gamesPictionary: on(process.env.NEXT_PUBLIC_FEATURE_GAMES_PICTIONARY),
  findFriends: on(process.env.NEXT_PUBLIC_FEATURE_FIND_FRIENDS),
  familyStory: on(process.env.NEXT_PUBLIC_FEATURE_FAMILY_STORY),
  podcast: on(process.env.NEXT_PUBLIC_FEATURE_PODCAST),
  impact: on(process.env.NEXT_PUBLIC_FEATURE_IMPACT),
  keepsakes: on(process.env.NEXT_PUBLIC_FEATURE_KEEPSAKES),
};
