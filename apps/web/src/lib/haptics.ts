/** navigator.vibrate(10) on like, long-press, vote (Android; no-op elsewhere). */
export const tap = (ms = 10) => {
  try {
    navigator.vibrate?.(ms);
  } catch {}
};
