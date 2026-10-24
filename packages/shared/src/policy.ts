import type { ApprovalDecision, PolicyMode } from './enums';

/** Pure policy functions used by api, MCP, and UI (UI only greys out buttons). Plan section 8.4 / 8.12. */

export type PolicySnapshot = {
  mode: PolicyMode;
  threshold?: number | null;
  eligibleVoterIds: string[];
};

export type DraftForPolicy = {
  version: number;
  createdByAi: boolean;
  policySnapshot: PolicySnapshot;
};

export type Approval = {
  userId: string;
  version: number;
  decision: ApprovalDecision;
};

export function validApprovers(d: DraftForPolicy, approvals: Approval[]): Set<string> {
  return new Set(
    approvals
      .filter(
        (a) =>
          a.version === d.version &&
          a.decision === 'approve' &&
          d.policySnapshot.eligibleVoterIds.includes(a.userId),
      )
      .map((a) => a.userId),
  );
}

export function mayPublish(
  d: DraftForPolicy,
  approvals: Approval[],
  actor: { userId: string; canDirect: boolean },
): boolean {
  const valid = validApprovers(d, approvals);
  switch (d.policySnapshot.mode) {
    case 'direct':
    case 'courtesy':
      // AI drafts never publish directly, even under direct policy; they need at least one approval.
      if (d.createdByAi) return valid.size >= 1;
      return actor.canDirect;
    case 'threshold':
      return valid.size >= (d.policySnapshot.threshold ?? 1);
    case 'unanimous':
      return (
        d.policySnapshot.eligibleVoterIds.length > 0 && d.policySnapshot.eligibleVoterIds.every((id) => valid.has(id))
      );
  }
}

/** Number of approvals still needed for threshold/unanimous drafts (UI "2 of 3 approvals"). */
export function approvalsNeeded(d: DraftForPolicy): number {
  switch (d.policySnapshot.mode) {
    case 'threshold':
      return d.policySnapshot.threshold ?? 1;
    case 'unanimous':
      return d.policySnapshot.eligibleVoterIds.length;
    default:
      return d.createdByAi ? 1 : 0;
  }
}

export type PodcastForPolicy = {
  wrapped: boolean;
  requiredParticipantIds: string[];
  /** user ids that have at least one valid clip across the show's stations */
  engagedUserIds: string[];
};

export function canFinishPodcast(show: PodcastForPolicy): boolean {
  if (!show.wrapped) return false;
  const engaged = new Set(show.engagedUserIds);
  return show.requiredParticipantIds.every((id) => engaged.has(id));
}

export function missingPodcastParticipants(show: PodcastForPolicy): string[] {
  const engaged = new Set(show.engagedUserIds);
  return show.requiredParticipantIds.filter((id) => !engaged.has(id));
}
