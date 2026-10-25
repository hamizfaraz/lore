import type { RecapLayout, RecapState } from '@lore/shared/enums';

export type MemoryMedia = {
  id: string;
  ownerUserId: string | null;
  kind: 'image' | 'video' | 'audio' | 'generated_image' | 'render';
  mime: string;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  blurhash: string | null;
  aiGenerated: boolean;
  generator: string | null;
  transcript: string | null;
  transcriptStatus: 'none' | 'pending' | 'done' | 'failed';
  captionAi: string | null;
  consentScope: Record<string, unknown> | null;
  createdAt: Date;
  sourceMessageIds: string[];
  quality: number;
  perceptualHash: string | null;
};

export type MemoryMessage = {
  id: string;
  body: string | null;
  createdAt: Date;
};

export type StoredRecap = {
  id: string;
  conversationId: string;
  eventId: string | null;
  planId: string | null;
  title: string;
  caption: string;
  layout: RecapLayout;
  mediaIds: string[];
  coverMediaId: string | null;
  collageMediaId: string | null;
  musicLabel: string | null;
  factsUsed: Array<{ claim: string; sourceMessageId: string }> | null;
  state: RecapState;
  createdByAi: boolean;
  createdAt: Date;
};

export type RecapConsent = {
  recapId: string;
  mediaId: string;
  ownerUserId: string;
  include: boolean;
};
