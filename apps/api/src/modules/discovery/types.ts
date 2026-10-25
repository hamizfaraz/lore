import type { AccountSummaryDTO } from '@lore/shared/dto/users';

export type StoredInterestProfile = {
  userId: string;
  explicitTags: string[];
  inferred: Record<string, number>;
  frozen: boolean;
  discoverable: boolean;
  bioSnippet: string | null;
  embedding: number[] | null;
  updatedAt: Date;
};

export type DiscoveryCandidate = StoredInterestProfile & { account: AccountSummaryDTO };

export type StoredIntroduction = {
  id: string;
  fromUserId: string;
  toUserId: string;
  basis: { sharedTags: string[]; reason: string };
  firstMessage: string | null;
  state: 'requested' | 'accepted' | 'declined' | 'expired';
  createdAt: Date;
};
