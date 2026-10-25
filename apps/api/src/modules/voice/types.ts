export type VoiceMediaRecord = {
  id: string;
  ownerUserId: string | null;
  kind: string;
  mime: string;
  transcript: string | null;
  transcriptStatus: 'none' | 'pending' | 'done' | 'failed';
};

export type VoiceMessageRef = {
  id: string;
  conversationId: string;
  senderUserId: string | null;
};

export type VoiceAudit = {
  userId: string;
  mediaId: string;
  outcome: 'ok' | 'error';
  degraded?: boolean;
  source?: string;
  model?: string;
  detail?: string;
};

export type NormalizedLiveTranscript = { text: string; final: boolean };
