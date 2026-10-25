import { createHash } from 'node:crypto';
import { and, eq, groupPlans, keepsakes, or, recaps, userWallets } from '@lore/db';
import type { KeepsakeDTO } from '@lore/shared/dto/keepsakes';
import { uuidv7 } from '@lore/shared/ids';
import { Keypair } from '@solana/web3.js';
import { env, flags } from '../../lib/env';
import { getDb } from '../../lib/db';
import { badRequest, notFound } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { enqueue } from '../../lib/queues';
import * as chat from '../chat/service';
import * as media from '../media/service';
import { type MintFn, mintOnDevnet } from './solana';

/** keepsakes business logic [C1] — devnet Core mint for a saved recap (section 8.15). */

const SAVED_RECAP = new Set(['ready_private', 'edited', 'proposed', 'saved']);

type StoredMeta = {
  name: string;
  description: string;
  collageMediaId: string | null;
  attributes: { trait_type: string; value: string }[];
  members: string[];
  contentSha256: string;
  planDate: string | null;
  error?: string;
};

let minter: MintFn = mintOnDevnet;

/** Tests inject a mint function so CI never talks to devnet. */
export function setMinterForTests(fn: MintFn | null) {
  minter = fn ?? mintOnDevnet;
}

function enabled() {
  const v = process.env.FEATURE_KEEPSAKES;
  if (v === '1' || v === 'true') return true;
  if (v === '0' || v === 'false') return false;
  return flags.FEATURE_KEEPSAKES;
}

function explorerUrl(signature: string | null): string | null {
  if (!signature) return null;
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

function metadataUrl(id: string) {
  return `${env.APP_URL.replace(/\/$/, '')}/v1/keepsakes/${id}/metadata`;
}

function toDTO(row: typeof keepsakes.$inferSelect): KeepsakeDTO {
  return {
    id: row.id,
    recapId: row.recapId,
    mintAddress: row.mintAddress,
    txSignature: row.txSignature,
    network: row.network,
    explorerUrl: explorerUrl(row.txSignature),
    status: row.status,
  };
}

/** Pubkey only. The secret is discarded; members never hold SOL (section 8.15). */
export async function ensureWallet(userId: string): Promise<string> {
  const db = getDb();
  const [existing] = await db.select().from(userWallets).where(eq(userWallets.userId, userId)).limit(1);
  if (existing) return existing.pubkey;
  const pubkey = Keypair.generate().publicKey.toBase58();
  await db.insert(userWallets).values({ userId, pubkey }).onConflictDoNothing();
  const [row] = await db.select().from(userWallets).where(eq(userWallets.userId, userId)).limit(1);
  return row?.pubkey ?? pubkey;
}

async function memberPubkeys(conversationId: string): Promise<string[]> {
  const members = await chat.activeMembers(conversationId);
  const pubs: string[] = [];
  for (const m of members.sort((a, b) => a.userId.localeCompare(b.userId))) {
    pubs.push(await ensureWallet(m.userId));
  }
  return pubs;
}

async function imageUrl(mediaId: string | null): Promise<string> {
  if (!mediaId) return '';
  const url = await media.signedUrl(mediaId).catch(() => null);
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${env.APP_URL.replace(/\/$/, '')}${url.startsWith('/') ? '' : '/'}${url}`;
}

async function safeEnqueue(keepsakeId: string) {
  try {
    await enqueue('keepsakes.mint', { keepsakeId });
  } catch (err) {
    logger.warn({ err, keepsakeId }, 'keepsake enqueue failed');
    await getDb()
      .update(keepsakes)
      .set({
        status: 'failed',
        metadata: { error: 'Could not queue the mint. The recap is still saved.' },
      })
      .where(eq(keepsakes.id, keepsakeId));
  }
}

/**
 * A member asks to mint. Returns immediately. The worker mints; a failure stays on this row
 * and never rolls back the recap.
 */
export async function requestKeepsake(userId: string, recapId: string): Promise<KeepsakeDTO> {
  if (!enabled()) throw badRequest('Keepsakes are not enabled');
  const db = getDb();
  const [recap] = await db.select().from(recaps).where(eq(recaps.id, recapId)).limit(1);
  if (!recap) throw notFound('Recap not found');
  await chat.requireMember(recap.conversationId, userId);
  if (!SAVED_RECAP.has(recap.state)) throw badRequest('Save the recap before making a keepsake');

  const planConds = [eq(groupPlans.recapId, recap.id)];
  if (recap.planId) planConds.push(eq(groupPlans.id, recap.planId), eq(groupPlans.proposalId, recap.planId));
  const plans = await db
    .select()
    .from(groupPlans)
    .where(or(...planConds)!);
  const plan = plans.find((p) => p.state === 'confirmed' || p.state === 'completed');
  if (!plan) throw badRequest('A keepsake needs a recap of a confirmed plan');

  const [existing] = await db.select().from(keepsakes).where(eq(keepsakes.recapId, recapId)).limit(1);
  if (existing && existing.status !== 'failed') return toDTO(existing);

  const members = await memberPubkeys(recap.conversationId);
  const contentSha256 = createHash('sha256')
    .update([recap.title, recap.caption, recap.mediaIds.join(','), plan.id].join('\n'))
    .digest('hex');
  const planDate = plan.startsAt.toISOString().slice(0, 10);
  const meta: StoredMeta = {
    name: recap.title,
    description: recap.caption || 'A shared memory on LORE.',
    collageMediaId: recap.collageMediaId,
    attributes: [
      { trait_type: 'plan_date', value: planDate },
      { trait_type: 'member_count', value: String(members.length) },
      { trait_type: 'content_sha256', value: contentSha256 },
    ],
    members,
    contentSha256,
    planDate,
  };

  if (existing) {
    await db
      .update(keepsakes)
      .set({ status: 'pending', txSignature: null, mintAddress: null, metadata: meta })
      .where(eq(keepsakes.id, existing.id));
    await safeEnqueue(existing.id);
    const [row] = await db.select().from(keepsakes).where(eq(keepsakes.id, existing.id)).limit(1);
    return toDTO(row!);
  }

  const id = uuidv7();
  await db.insert(keepsakes).values({
    id,
    recapId: recap.id,
    conversationId: recap.conversationId,
    network: 'devnet',
    status: 'pending',
    metadata: meta,
  });
  await safeEnqueue(id);
  const [row] = await db.select().from(keepsakes).where(eq(keepsakes.id, id)).limit(1);
  return toDTO(row!);
}

export async function forRecap(recapId: string, userId: string): Promise<KeepsakeDTO | null> {
  const db = getDb();
  const [row] = await db.select().from(keepsakes).where(eq(keepsakes.recapId, recapId)).limit(1);
  if (!row) return null;
  await chat.requireMember(row.conversationId, userId);
  return toDTO(row);
}

export async function view(id: string, userId: string): Promise<KeepsakeDTO> {
  const [row] = await getDb().select().from(keepsakes).where(eq(keepsakes.id, id)).limit(1);
  if (!row) throw notFound('Keepsake not found');
  await chat.requireMember(row.conversationId, userId);
  return toDTO(row);
}

/** Public JSON the asset URI points at. The explorer fetches this; no session. */
export async function publicMetadata(id: string) {
  const [row] = await getDb().select().from(keepsakes).where(eq(keepsakes.id, id)).limit(1);
  if (!row) throw notFound('Keepsake not found');
  const meta = (row.metadata ?? {}) as StoredMeta;
  return {
    name: meta.name ?? 'LORE keepsake',
    description: meta.description ?? 'A shared memory on LORE. Devnet only.',
    image: await imageUrl(meta.collageMediaId ?? null),
    attributes: meta.attributes ?? [],
    properties: {
      members: meta.members ?? [],
      contentSha256: meta.contentSha256 ?? '',
      network: 'devnet',
    },
  };
}

/** Worker entry. Throws after recording failure so BullMQ can retry. The recap is untouched. */
export async function mintKeepsake(id: string): Promise<KeepsakeDTO> {
  const db = getDb();
  const [row] = await db.select().from(keepsakes).where(eq(keepsakes.id, id)).limit(1);
  if (!row) throw notFound('Keepsake not found');
  if (row.status === 'minted' && row.txSignature) return toDTO(row);
  const meta = (row.metadata ?? {}) as StoredMeta;
  try {
    const result = await minter({
      name: (meta.name ?? 'LORE keepsake').slice(0, 32),
      uri: metadataUrl(row.id),
      attributes: [
        { key: 'plan_date', value: meta.planDate ?? '' },
        { key: 'member_count', value: String(meta.members?.length ?? 0) },
      ],
    });
    const [updated] = await db
      .update(keepsakes)
      .set({
        status: 'minted',
        mintAddress: result.mintAddress,
        txSignature: result.txSignature,
        metadata: { ...meta, error: undefined },
      })
      .where(and(eq(keepsakes.id, id)))
      .returning();
    return toDTO(updated!);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Mint failed';
    await db
      .update(keepsakes)
      .set({ status: 'failed', metadata: { ...meta, error: message } })
      .where(eq(keepsakes.id, id));
    logger.warn({ err, id }, 'keepsake mint failed');
    throw err;
  }
}
