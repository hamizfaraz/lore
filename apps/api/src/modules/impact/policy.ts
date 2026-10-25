import { createHash } from 'node:crypto';
import { IMPACT_EVENT_KINDS, type ImpactEventInput, type ImpactEventKind } from './types';

const ALLOWED_PROPS: Record<ImpactEventKind, ReadonlySet<string>> = {
  plan_suggested: new Set(['candidateCount']),
  plan_vote_cast: new Set(['response']),
  plan_confirmed: new Set(['voteCount', 'intentToConfirmMs']),
  recap_ready: new Set(['mediaCount']),
  recap_posted: new Set(['destination']),
  intro_requested: new Set(),
  intro_accepted: new Set(),
  ai_interaction: new Set(['outcome']),
  ai_muted: new Set(['duration']),
};

const ENUM_VALUES = new Set([
  'yes',
  'flexible',
  'no',
  'veto',
  'group_post',
  'spoke',
  'silent',
  'one_hour',
  'eight_hours',
  'until_unmuted',
  'unmute',
]);

export function hashAnalyticsId(value: string | null | undefined, namespace: string, salt: string) {
  if (!value) return null;
  return createHash('sha256').update(`${salt}:${namespace}:${value}`).digest('hex');
}

export function sanitizeImpactProps(kind: ImpactEventKind, props: Record<string, unknown> = {}) {
  const clean: Record<string, unknown> = {};
  for (const key of ALLOWED_PROPS[kind]) {
    const value = props[key];
    if (typeof value === 'number' && Number.isFinite(value)) clean[key] = Math.max(0, Math.round(value));
    if (typeof value === 'string' && ENUM_VALUES.has(value)) clean[key] = value;
  }
  return clean;
}

export function sanitizeImpactEvent(input: ImpactEventInput, salt: string) {
  if (!IMPACT_EVENT_KINDS.includes(input.kind)) throw new Error('Unsupported impact event kind');
  return {
    kind: input.kind,
    groupHash: hashAnalyticsId(input.groupId, 'group', salt),
    actorHash: hashAnalyticsId(input.actorId, 'actor', salt),
    props: {
      ...sanitizeImpactProps(input.kind, input.props),
      ...(input.objectId ? { objectHash: hashAnalyticsId(input.objectId, 'object', salt) } : {}),
    },
    at: input.at ?? new Date(),
  };
}
