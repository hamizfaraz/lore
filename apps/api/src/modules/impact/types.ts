export const IMPACT_EVENT_KINDS = [
  'plan_suggested',
  'plan_vote_cast',
  'plan_confirmed',
  'recap_ready',
  'recap_posted',
  'intro_requested',
  'intro_accepted',
  'ai_interaction',
  'ai_muted',
] as const;
export type ImpactEventKind = (typeof IMPACT_EVENT_KINDS)[number];

export type ImpactEventInput = {
  kind: ImpactEventKind;
  groupId?: string | null;
  actorId?: string | null;
  objectId?: string | null;
  props?: Record<string, unknown>;
  at?: Date;
};

export type ImpactEventRow = {
  eventId: string;
  at: Date;
  kind: ImpactEventKind;
  groupHash: string | null;
  actorHash: string | null;
  props: Record<string, unknown>;
};

export type SyncCursor = { lastAt: Date; lastEventId: string } | null;
