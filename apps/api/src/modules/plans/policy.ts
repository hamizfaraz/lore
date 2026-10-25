import type { GroupIntentBrief, PlanRanking } from '@lore/shared/ai';
import type { PlanCandidate, PlanPreference } from './types';

const fitScore = { great: 2, ok: 1, conflict: 0 } as const;

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9.]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function timeAllowed(candidate: PlanCandidate, windows: unknown): boolean {
  if (!candidate.startsAt || !Array.isArray(windows) || windows.length === 0) return true;
  const at = candidate.startsAt.getTime();
  return windows.some((window) => {
    if (!window || typeof window !== 'object') return true;
    const record = window as Record<string, unknown>;
    const start = typeof record.start === 'string' ? Date.parse(record.start) : Number.NaN;
    const end = typeof record.end === 'string' ? Date.parse(record.end) : Number.NaN;
    return (!Number.isFinite(start) || at >= start) && (!Number.isFinite(end) || at <= end);
  });
}

/** Apply only explicit hard limits. Unknown price is retained and labeled later. */
export function applyHardConstraints(
  candidates: PlanCandidate[],
  hardConstraints: GroupIntentBrief['hardConstraints'],
): PlanCandidate[] {
  const budget = Math.min(
    ...hardConstraints
      .filter((constraint) => constraint.key === 'budget_max')
      .map((constraint) => numberValue(constraint.value))
      .filter((value): value is number => value !== null),
    Number.POSITIVE_INFINITY,
  );
  const travel = Math.min(
    ...hardConstraints
      .filter((constraint) => constraint.key === 'travel_minutes')
      .map((constraint) => numberValue(constraint.value))
      .filter((value): value is number => value !== null),
    Number.POSITIVE_INFINITY,
  );
  const windows = hardConstraints.find((constraint) => constraint.key === 'time_windows')?.value;
  return candidates.filter((candidate) => {
    if (candidate.priceAmount !== null && candidate.priceAmount > budget) return false;
    if (candidate.travelMinutes !== null && candidate.travelMinutes > travel) return false;
    return timeAllowed(candidate, windows);
  });
}

export function ensureAtHomeOption(candidates: PlanCandidate[], fallback: PlanCandidate): PlanCandidate[] {
  return candidates.some((candidate) => candidate.category === 'at_home' || candidate.category === 'online')
    ? candidates
    : [...candidates, fallback];
}

/** Venue-like results must remain traceable to a real source. */
export function validCandidate(candidate: PlanCandidate): boolean {
  if (!candidate.name.trim()) return false;
  if (candidate.category === 'place' || candidate.category === 'event') {
    if (!candidate.url) return false;
    try {
      return new URL(candidate.url).protocol.startsWith('http');
    } catch {
      return false;
    }
  }
  return true;
}

/** Fair ordering: maximize the least-happy member, then total fit, while preserving category variety. */
export function maximinDiverse(
  ranking: PlanRanking,
  candidates: PlanCandidate[],
  limit = 3,
): PlanRanking['options'] {
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const scored = ranking.options
    .filter((option) => byId.has(option.candidateId))
    .map((option) => {
      const scores: number[] = option.fitByMember.map((fit) => fitScore[fit.fit]);
      return {
        option,
        category: byId.get(option.candidateId)!.category,
        minimum: scores.length ? Math.min(...scores) : 0,
        total: scores.reduce((sum, score) => sum + score, 0),
      };
    })
    .sort(
      (left, right) =>
        right.minimum - left.minimum ||
        right.total - left.total ||
        left.option.candidateId.localeCompare(right.option.candidateId),
    );
  const chosen: typeof scored = [];
  for (const item of scored) {
    if (!chosen.some((existing) => existing.category === item.category)) chosen.push(item);
    if (chosen.length === limit) break;
  }
  for (const item of scored) {
    if (!chosen.includes(item)) chosen.push(item);
    if (chosen.length === limit) break;
  }
  return chosen.map((item) => item.option);
}

/** Model prompts may know private constraints, but user-facing evidence never exposes who supplied them. */
export function preferenceSummary(preferences: PlanPreference[]): string | null {
  if (!preferences.length) return null;
  const groupKeys = [
    ...new Set(preferences.filter((pref) => pref.visibility === 'group').map((pref) => pref.key)),
  ];
  const hasPrivate = preferences.some((pref) => pref.visibility === 'ai_only');
  const parts = [
    groupKeys.length ? `Group preferences: ${groupKeys.join(', ')}` : '',
    hasPrivate ? 'Some private constraints were honored.' : '',
  ];
  return parts.filter(Boolean).join(' ') || null;
}

export function candidatePriceUnverified(candidate: PlanCandidate): boolean {
  return candidate.priceAmount === null && !candidate.priceText;
}
