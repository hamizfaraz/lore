export const PROVIDER_BACKOFF_MS = [0, 500, 1_000, 2_000] as const;

export class ProviderHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ProviderHttpError';
  }
}

export function isRetryableProviderError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const status = (error as { status?: unknown }).status;
  return status === 429 || (typeof status === 'number' && status >= 500);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** One initial attempt followed by the plan's 0.5 s, 1 s, and 2 s retry delays. */
export async function withProviderBackoff<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (const delayMs of PROVIDER_BACKOFF_MS) {
    if (delayMs) await sleep(delayMs);
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryableProviderError(error)) throw error;
    }
  }
  throw lastError;
}
