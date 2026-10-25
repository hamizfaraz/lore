import { describe, expect, it, vi } from 'vitest';
import { runTranscriptionJob } from './jobs';

const job = (attemptsMade: number) => ({
  data: { mediaId: 'media-1' },
  attemptsMade,
  opts: { attempts: 3 },
});

describe('voice transcription job', () => {
  it('retries intermediate failures without publishing a failed state', async () => {
    const process = vi.fn(async () => {
      throw new Error('temporary');
    });
    const markFailed = vi.fn();
    await expect(runTranscriptionJob(job(0) as never, process, markFailed)).rejects.toThrow('temporary');
    expect(markFailed).not.toHaveBeenCalled();
  });

  it('publishes failure only after the final configured attempt', async () => {
    const process = vi.fn(async () => {
      throw new Error('still down');
    });
    const markFailed = vi.fn(async () => undefined);
    await expect(runTranscriptionJob(job(2) as never, process, markFailed)).rejects.toThrow('still down');
    expect(markFailed).toHaveBeenCalledWith('media-1', expect.any(Error));
  });

  it('returns an idempotent completed result without marking failure', async () => {
    const completed = {
      mediaId: 'media-1',
      transcript: 'already done',
      status: 'done' as const,
      degraded: false,
    };
    const process = vi.fn(async () => completed);
    const markFailed = vi.fn();
    await expect(runTranscriptionJob(job(1) as never, process, markFailed)).resolves.toEqual(completed);
    expect(markFailed).not.toHaveBeenCalled();
  });
});
