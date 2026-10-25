import { transcribeMuseBatch } from '@lore/ai';
import type { MuseTranscript } from '@lore/ai';
import type { TranscribeResult } from '@lore/shared/dto/voice';
import { uuidv7 } from '@lore/shared/ids';
import { badRequest, forbidden, notFound } from '../../lib/errors';
import { enqueue } from '../../lib/queues';
import { updateMessage } from '../chat/service';
import { signedUrl } from '../media/service';
import { toWav24k } from './audio';
import { VoiceRepository, voiceRepository } from './repository';
import type { VoiceAudit, VoiceMediaRecord, VoiceMessageRef } from './types';

const MAX_AUDIO_BYTES = 15 * 1024 * 1024;
const BATCH_DEADLINE_MS = 6_000;

async function withDeadline<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Voice transcription exceeded ${ms} ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

type VoiceStore = Pick<
  VoiceRepository,
  | 'media'
  | 'messagesForMedia'
  | 'setTranscript'
  | 'isConversationMember'
  | 'keywordsForConversation'
  | 'audit'
>;

type VoiceDependencies = {
  store: VoiceStore;
  enqueue: (mediaId: string, retry: boolean) => Promise<unknown>;
  signedUrl: (mediaId: string) => Promise<string | null>;
  fetchAudio: (url: string) => Promise<Buffer>;
  convert: (input: Buffer) => Promise<Buffer>;
  transcribe: (input: {
    audio: Buffer;
    sessionId: string;
    filename: string;
    keywords: string[];
  }) => Promise<MuseTranscript>;
  updateMessage: typeof updateMessage;
};

async function fetchAudio(url: string): Promise<Buffer> {
  const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error(`Voice media download failed (${response.status})`);
  const declared = Number(response.headers.get('content-length') ?? 0);
  if (declared > MAX_AUDIO_BYTES) throw badRequest('Voice note is too large');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) throw badRequest('Voice note is empty');
  if (bytes.length > MAX_AUDIO_BYTES) throw badRequest('Voice note is too large');
  return bytes;
}

const defaults: VoiceDependencies = {
  store: voiceRepository,
  enqueue: (mediaId, retry) =>
    enqueue(
      'voice.transcribe',
      { mediaId },
      {
        jobId: retry ? `transcribe-${mediaId}-${uuidv7()}` : `transcribe-${mediaId}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 500 },
      },
    ),
  signedUrl: (mediaId) => signedUrl(mediaId),
  fetchAudio,
  convert: toWav24k,
  transcribe: (input) => transcribeMuseBatch(input),
  updateMessage,
};

function result(media: VoiceMediaRecord, degraded = false): TranscribeResult {
  return {
    mediaId: media.id,
    transcript: media.transcript,
    status: media.transcriptStatus === 'none' ? 'pending' : media.transcriptStatus,
    degraded,
  };
}

export class VoiceService {
  constructor(private readonly deps: VoiceDependencies = defaults) {}

  async request(mediaId: string, userId?: string): Promise<TranscribeResult> {
    const media = await this.deps.store.media(mediaId);
    if (!media) throw notFound('Voice media not found');
    if (media.kind !== 'audio') throw badRequest('Only audio media can be transcribed');
    if (userId && media.ownerUserId !== userId)
      throw forbidden('You can only transcribe your own voice note');
    if (media.transcriptStatus === 'done' && media.transcript) return result(media);

    if (media.transcriptStatus !== 'pending') await this.deps.store.setTranscript(mediaId, null, 'pending');
    await this.deps.enqueue(mediaId, media.transcriptStatus === 'failed');
    return { mediaId, transcript: null, status: 'pending', degraded: false };
  }

  async process(mediaId: string): Promise<TranscribeResult> {
    const media = await this.deps.store.media(mediaId);
    if (!media) throw notFound('Voice media not found');
    if (media.kind !== 'audio') throw badRequest('Only audio media can be transcribed');
    if (media.transcriptStatus === 'done' && media.transcript) return result(media);

    const refs = await this.deps.store.messagesForMedia(mediaId);
    const conversationId = refs[0]?.conversationId;
    const keywords = conversationId ? await this.deps.store.keywordsForConversation(conversationId) : [];
    const url = await this.deps.signedUrl(mediaId);
    if (!url) throw notFound('Voice media object not found');
    const transcript = await withDeadline(
      (async () => {
        const original = await this.deps.fetchAudio(url);
        const wav = await this.deps.convert(original);
        return this.deps.transcribe({
          audio: wav,
          sessionId: uuidv7(),
          filename: `${mediaId}.wav`,
          keywords,
        });
      })(),
      BATCH_DEADLINE_MS,
    );
    const text = transcript.text.trim();
    if (!text) throw new Error('Voice provider returned an empty transcript');

    await this.deps.store.setTranscript(mediaId, text, 'done');
    await this.notify(refs, {
      transcriptStatus: 'done',
      transcriptDegraded: transcript.degraded,
      transcriptSource: transcript.source,
      transcriptModel: transcript.model,
      transcriptSpeakerUserId: media.ownerUserId,
    });
    await this.audit({
      userId: media.ownerUserId ?? '',
      mediaId,
      outcome: 'ok',
      degraded: transcript.degraded,
      source: transcript.source,
      model: transcript.model,
      detail: transcript.degraded
        ? 'Provider degraded to a labeled fallback transcript'
        : 'Transcription completed',
    });
    return { mediaId, transcript: text, status: 'done', degraded: transcript.degraded };
  }

  async markFailed(mediaId: string, error: unknown): Promise<void> {
    const media = await this.deps.store.media(mediaId);
    if (!media || (media.transcriptStatus === 'done' && media.transcript)) return;
    const refs = await this.deps.store.messagesForMedia(mediaId);
    await this.deps.store.setTranscript(mediaId, null, 'failed');
    await this.notify(refs, {
      transcriptStatus: 'failed',
      transcriptDegraded: false,
      transcriptSpeakerUserId: media.ownerUserId,
    });
    await this.audit({
      userId: media.ownerUserId ?? '',
      mediaId,
      outcome: 'error',
      detail: error instanceof Error ? error.message : 'Unknown transcription error',
    });
  }

  async isConversationMember(conversationId: string, userId: string) {
    return this.deps.store.isConversationMember(conversationId, userId);
  }

  async keywordsForConversation(conversationId: string) {
    return this.deps.store.keywordsForConversation(conversationId);
  }

  private async notify(refs: VoiceMessageRef[], meta: Record<string, unknown>) {
    await Promise.allSettled(refs.map((ref) => this.deps.updateMessage(ref.id, { meta })));
  }

  private async audit(entry: VoiceAudit) {
    if (!entry.userId) return;
    await this.deps.store.audit(entry).catch(() => undefined);
  }
}

export const voiceService = new VoiceService();

/** Cross-boundary [C2 implements, C1 calls]: idempotently queue a voice-media transcription. */
export async function transcribeMedia(mediaId: string): Promise<void> {
  await voiceService.request(mediaId);
}

export const requestTranscription = (mediaId: string, userId: string) =>
  voiceService.request(mediaId, userId);
export const processTranscription = (mediaId: string) => voiceService.process(mediaId);
export const markTranscriptionFailed = (mediaId: string, error: unknown) =>
  voiceService.markFailed(mediaId, error);

export function createVoiceServiceForTest(overrides: Partial<VoiceDependencies>) {
  return new VoiceService({ ...defaults, ...overrides });
}
