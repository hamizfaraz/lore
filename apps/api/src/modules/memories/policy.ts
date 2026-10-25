import { assertRecapReferences } from '@lore/ai';
import type { RecapDraftSpec } from '@lore/shared/ai';
import type { MemoryMedia, MemoryMessage, RecapConsent } from './types';

const NINETY_MINUTES = 90 * 60 * 1_000;
const SIX_HOURS = 6 * 60 * 60 * 1_000;

/** Split on gaps over 90 minutes; only event-like groups of three or more survive. */
export function clusterMedia(media: MemoryMedia[]): MemoryMedia[][] {
  const sorted = [...media].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  const clusters: MemoryMedia[][] = [];
  for (const item of sorted) {
    const current = clusters.at(-1);
    if (!current || item.createdAt.getTime() - current.at(-1)!.createdAt.getTime() > NINETY_MINUTES) {
      clusters.push([item]);
    } else {
      current.push(item);
    }
  }
  return clusters.filter((cluster) => {
    const span = cluster.at(-1)!.createdAt.getTime() - cluster[0]!.createdAt.getTime();
    return cluster.length >= 3 && span <= SIX_HOURS;
  });
}

export function hashDistance(left: string, right: string): number {
  try {
    const a = BigInt(`0x${left}`);
    const b = BigInt(`0x${right}`);
    let xor = a ^ b;
    let distance = 0;
    while (xor > 0n) {
      distance += Number(xor & 1n);
      xor >>= 1n;
    }
    return distance;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

/** Keep the highest-quality image from every pHash neighborhood (distance <= 6). */
export function removeNearDuplicates(media: MemoryMedia[]): MemoryMedia[] {
  const chosen: MemoryMedia[] = [];
  for (const item of [...media].sort((left, right) => right.quality - left.quality)) {
    if (
      item.perceptualHash &&
      chosen.some(
        (existing) =>
          existing.perceptualHash && hashDistance(item.perceptualHash!, existing.perceptualHash) <= 6,
      )
    ) {
      continue;
    }
    chosen.push(item);
  }
  return chosen.sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
}

export function consentedMedia(media: MemoryMedia[], consents: RecapConsent[] = []): MemoryMedia[] {
  const byId = new Map(consents.map((consent) => [consent.mediaId, consent.include]));
  return media.filter((item) => item.consentScope?.recaps !== false && byId.get(item.id) !== false);
}

export function groundedRecap(
  draft: RecapDraftSpec,
  messages: MemoryMessage[],
  media: MemoryMedia[],
): RecapDraftSpec {
  return assertRecapReferences(draft, {
    messageIds: messages.map((message) => message.id),
    mediaIds: media.map((item) => item.id),
  });
}
