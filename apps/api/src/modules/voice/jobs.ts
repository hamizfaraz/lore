import type { JobProcessor } from '../../lib/module';
import { z } from 'zod';
import { markTranscriptionFailed, processTranscription } from './service';

/** voice BullMQ processors [C2]. Job names are `voice.<job>`. */
const payload = z.object({ mediaId: z.string() });

export async function runTranscriptionJob(
  job: Pick<Parameters<JobProcessor>[0], 'data' | 'attemptsMade' | 'opts'>,
  process = processTranscription,
  markFailed = markTranscriptionFailed,
) {
  const { mediaId } = payload.parse(job.data);
  try {
    return await process(mediaId);
  } catch (error) {
    const attempts = job.opts.attempts ?? 1;
    if (job.attemptsMade + 1 >= attempts) await markFailed(mediaId, error);
    throw error;
  }
}

export const jobs: Record<string, JobProcessor> = {
  'voice.transcribe': (job) => runTranscriptionJob(job),
};
