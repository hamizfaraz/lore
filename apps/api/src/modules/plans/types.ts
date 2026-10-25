import type { GroupIntentBrief, PlanRanking } from '@lore/shared/ai';
import type { Category, PrefKey } from '@lore/shared/enums';

export type PlanPreference = {
  id?: string;
  userId: string;
  key: PrefKey;
  value: unknown;
  visibility: 'group' | 'ai_only';
};

export type PlanCandidate = {
  id: string;
  source: 'serp_events' | 'serp_maps' | 'serp_kg' | 'serp_news' | 'seed';
  category: Category;
  name: string;
  url: string | null;
  imageUrl: string | null;
  address: string | null;
  startsAt: Date | null;
  priceText: string | null;
  priceAmount: number | null;
  travelMinutes: number | null;
  rating: number | null;
  lastVerifiedAt: Date | null;
  dedupeKey: string;
  embedding?: number[];
  raw?: Record<string, unknown> | null;
};

export type PlanContext = {
  conversationId: string;
  members: Array<{ userId: string; displayName: string }>;
  preferences: PlanPreference[];
};

export type StoredProposal = {
  id: string;
  conversationId: string;
  version: number;
  status: 'suggested' | 'voting' | 'revised' | 'selected' | 'confirmed' | 'completed' | 'dismissed';
  brief: GroupIntentBrief | null;
  options: PlanRanking & { degraded?: boolean };
  createdBy: 'ai' | 'user';
  createdAt: Date;
};

export type StoredVote = {
  proposalId: string;
  version: number;
  userId: string;
  candidateId: string;
  response: 'yes' | 'flexible' | 'no' | 'veto';
};
