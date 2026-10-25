/** Discovery privacy and ranking rules. Inputs are public/explicit tags, never chat text. */
const SENSITIVE = /(?:diagnos|relig|politic|sexual|health|race|ethnic|income|address|phone|email|private)/i;
const CONTACT_DETAIL = /\d{3}\D*\d{3,4}/;
const TAG = /^[a-z0-9][a-z0-9 +&'-]{1,31}$/;
export const INFERENCE_HALF_LIFE_DAYS = 14;

export function normalizeTopicTag(value: string): string | null {
  const tag = value.trim().toLowerCase().replace(/\s+/g, ' ');
  return TAG.test(tag) && !SENSITIVE.test(tag) && !CONTACT_DETAIL.test(tag) ? tag : null;
}

export function safeTags(values: string[], limit = 24): string[] {
  return [...new Set(values.map(normalizeTopicTag).filter((tag): tag is string => Boolean(tag)))].slice(
    0,
    limit,
  );
}

export function decayScores(inferred: Record<string, number>, elapsedMs: number): Record<string, number> {
  const factor = 0.5 ** (Math.max(0, elapsedMs) / (INFERENCE_HALF_LIFE_DAYS * 86_400_000));
  return Object.fromEntries(
    Object.entries(inferred).map(([tag, score]) => [tag, score < 0 ? -1 : score * factor]),
  );
}

/** Decay each tag from its own last-scored time. Missing times fall back to the profile update. */
export function decayTouched(
  inferred: Record<string, number>,
  touched: Record<string, string>,
  updatedAt: Date,
  now: Date,
): { inferred: Record<string, number>; touched: Record<string, string> } {
  const nextInferred: Record<string, number> = {};
  const nextTouched = { ...touched };
  const nowIso = now.toISOString();
  for (const [tag, score] of Object.entries(inferred)) {
    if (score < 0) {
      nextInferred[tag] = -1;
      continue;
    }
    const at = touched[tag] ? new Date(touched[tag]).getTime() : updatedAt.getTime();
    const elapsed = now.getTime() - (Number.isFinite(at) ? at : updatedAt.getTime());
    nextInferred[tag] = decayScores({ [tag]: score }, elapsed)[tag]!;
    nextTouched[tag] = nowIso;
  }
  return { inferred: nextInferred, touched: nextTouched };
}

export function visibleInferred(inferred: Record<string, number>) {
  return Object.entries(inferred)
    .filter(([, score]) => score > 0.1)
    .sort((a, b) => b[1] - a[1])
    .map(([tag, score]) => ({ tag, score: Math.round(score * 1000) / 1000 }));
}

export function cosine(a: number[] | null, b: number[] | null): number {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0;
  let aa = 0;
  let bb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i]! * b[i]!;
    aa += a[i]! ** 2;
    bb += b[i]! ** 2;
  }
  return aa && bb ? Math.max(0, dot / Math.sqrt(aa * bb)) : 0;
}

export function matchScore(left: string[], right: string[], embeddings: [number[] | null, number[] | null]) {
  const a = new Set(left);
  const b = new Set(right);
  const shared = [...a].filter((tag) => b.has(tag));
  const union = new Set([...a, ...b]).size;
  const jaccard = union ? shared.length / union : 0;
  const complement = [...b].filter((tag) => !a.has(tag)).length;
  const serendipity = Math.min(1, complement / 3);
  return { shared, score: 0.45 * jaccard + 0.4 * cosine(...embeddings) + 0.15 * serendipity };
}
