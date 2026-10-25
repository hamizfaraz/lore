import type { SpeakDecision } from '@lore/shared/ai';
import type { DecisionTrigger, Initiative, MemoryKind, Sensitivity } from '@lore/shared/enums';

export type QuietHours = { start: string; end: string; tz: string };

export type PersonaRecord = {
  id: string;
  conversationId: string;
  name: string;
  avatarMediaId: string | null;
  tone: string[];
  interests: string[];
  boundaries: string | null;
  initiative: Initiative;
  quietHours: QuietHours | null;
  allowHistory: boolean;
  allowNews: boolean;
  allowImages: boolean;
  allowPlans: boolean;
  allowLocation: boolean;
  surpriseImagesPerWeek: number;
  enabled: boolean;
  mutedUntil: Date | null;
  createdByUserId: string | null;
  createdAt: Date;
};

export type MemoryRecord = {
  id: string;
  conversationId: string;
  kind: MemoryKind;
  summary: string;
  sourceMessageIds: string[];
  subjectUserIds: string[];
  sensitivity: Sensitivity;
  confidence: number;
  lastConfirmedAt: Date | null;
  expiresAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
};

export type TranscriptMessage = {
  id: string;
  conversationId: string;
  createdAt: Date;
  senderType: 'human' | 'ai' | 'system';
  senderUserId: string | null;
  senderName: string;
  body: string | null;
  kind: string;
  mediaIds: string[];
  replyToId: string | null;
};

export type PersonaMember = {
  userId: string;
  displayName: string;
  aiHistoryConsent: boolean;
};

export type PersonaContext = {
  conversationId: string;
  groupTitle: string;
  persona: PersonaRecord;
  members: PersonaMember[];
  memories: MemoryRecord[];
  messages: TranscriptMessage[];
  aiMessagesToday: number;
  lastAiAt: Date | null;
  lastHumanAt: Date | null;
  recentDecisionIntents: string[];
};

export type ConsiderInput = {
  conversationId: string;
  trigger: DecisionTrigger;
  sourceMessageId?: string;
  requestId?: string;
  requested?: boolean;
};

export type DecisionRecord = {
  conversationId: string;
  trigger: DecisionTrigger;
  speak: boolean;
  intent?: string;
  score?: number;
  reason: string;
  model?: string;
  latencyMs?: number;
};

export type ExtractedMemory = SpeakDecision['newMemories'][number] & {
  sourceMessageIds: string[];
};
