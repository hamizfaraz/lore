export interface SpeakDecisionReferences {
  speak: boolean;
  intent: string;
  memoryIdsUsed: string[];
  candidateId?: string;
  newMemories?: Array<{ subjectUserIds: string[]; [key: string]: unknown }>;
  events?: Array<{ sourceMessageIds: string[]; [key: string]: unknown }>;
  [key: string]: unknown;
}

export interface AllowedModelReferences {
  memoryIds?: Iterable<string>;
  candidateIds?: Iterable<string>;
  messageIds?: Iterable<string>;
  mediaIds?: Iterable<string>;
  userIds?: Iterable<string>;
}

function allowed(values: Iterable<string> | undefined): Set<string> {
  return new Set(values ?? []);
}

export function sanitizeSpeakDecision<T extends SpeakDecisionReferences>(
  decision: T,
  references: AllowedModelReferences,
): T {
  const memoryIds = allowed(references.memoryIds);
  const candidateIds = allowed(references.candidateIds);
  const messageIds = allowed(references.messageIds);
  const userIds = allowed(references.userIds);
  const candidateId =
    decision.candidateId && candidateIds.has(decision.candidateId) ? decision.candidateId : undefined;
  const forceSilence = decision.intent === 'news' && !candidateId;

  return {
    ...decision,
    speak: forceSilence ? false : decision.speak,
    memoryIdsUsed: decision.memoryIdsUsed.filter((id) => memoryIds.has(id)),
    ...(candidateId ? { candidateId } : { candidateId: undefined }),
    newMemories: decision.newMemories?.map((memory) => ({
      ...memory,
      subjectUserIds: memory.subjectUserIds.filter((id) => userIds.has(id)),
    })),
    events: decision.events?.map((event) => ({
      ...event,
      sourceMessageIds: event.sourceMessageIds.filter((id) => messageIds.has(id)),
    })),
  };
}

export interface PlanRankingReferences {
  options: Array<{
    candidateId: string;
    fitByMember?: Array<{ userId: string; [key: string]: unknown }>;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export function sanitizePlanRanking<T extends PlanRankingReferences>(
  ranking: T,
  references: Pick<AllowedModelReferences, 'candidateIds' | 'userIds'>,
): T {
  const candidateIds = allowed(references.candidateIds);
  const userIds = allowed(references.userIds);
  return {
    ...ranking,
    options: ranking.options
      .filter((option) => candidateIds.has(option.candidateId))
      .map((option) => ({
        ...option,
        fitByMember: option.fitByMember?.filter((fit) => userIds.has(fit.userId)),
      })),
  };
}

export interface RecapReferences {
  orderedMediaIds: string[];
  coverMediaId: string;
  factsUsed: Array<{ sourceMessageId: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

export function assertRecapReferences<T extends RecapReferences>(
  recap: T,
  references: Pick<AllowedModelReferences, 'messageIds' | 'mediaIds'>,
): T {
  const messageIds = allowed(references.messageIds);
  const mediaIds = allowed(references.mediaIds);
  const invalidFact = recap.factsUsed.find((fact) => !messageIds.has(fact.sourceMessageId));
  if (invalidFact) {
    throw new Error(`Recap fact cites an unknown message id: ${invalidFact.sourceMessageId}`);
  }
  const invalidMedia = [...recap.orderedMediaIds, recap.coverMediaId].find((id) => !mediaIds.has(id));
  if (invalidMedia) throw new Error(`Recap references an unknown media id: ${invalidMedia}`);
  return recap;
}
