import { eq, groupPlans, keepsakes, recaps, userWallets } from '@lore/db';
import { uuidv7 } from '@lore/shared/ids';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb, getDb } from '../../lib/db';
import { hasDb, makeGroup, makeUser } from '../../test/helpers';
import * as svc from './service';

const prevFlag = process.env.FEATURE_KEEPSAKES;

async function savedRecap(userIds: string[], opts: { plan?: boolean; state?: string } = {}) {
  const conv = await makeGroup(userIds, 'Crew');
  const planId = uuidv7();
  if (opts.plan !== false) {
    await getDb()
      .insert(groupPlans)
      .values({
        id: planId,
        proposalId: uuidv7(),
        conversationId: conv,
        candidateId: uuidv7(),
        title: 'Movie night',
        startsAt: new Date('2026-10-24T19:00:00Z'),
        tz: 'America/Chicago',
        confirmedByUserId: userIds[0],
        state: 'confirmed',
      });
  }
  const recapId = uuidv7();
  await getDb()
    .insert(recaps)
    .values({
      id: recapId,
      conversationId: conv,
      planId: opts.plan === false ? null : planId,
      title: 'Saturday movie night',
      caption: 'We watched Dune',
      state: (opts.state ?? 'saved') as 'saved',
      mediaIds: [],
    });
  return { conv, recapId };
}

describe.skipIf(!hasDb)('keepsakes.service', () => {
  beforeAll(() => {
    process.env.FEATURE_KEEPSAKES = '1';
    svc.setMinterForTests(async () => ({ mintAddress: 'MintDevnet111', txSignature: 'SigDevnet111' }));
  });
  afterAll(() => {
    process.env.FEATURE_KEEPSAKES = prevFlag;
    svc.setMinterForTests(null);
    return closeDb();
  });

  it('mints a devnet keepsake for a saved recap and is idempotent', async () => {
    const a = await makeUser('Ava');
    const b = await makeUser('Leo');
    const { recapId } = await savedRecap([a, b]);
    const first = await svc.requestKeepsake(a, recapId);
    expect(first.status === 'pending' || first.status === 'failed').toBe(true);
    const again = await svc.requestKeepsake(a, recapId);
    expect(again.id).toBe(first.id);

    const minted = await svc.mintKeepsake(first.id);
    expect(minted.status).toBe('minted');
    expect(minted.txSignature).toBe('SigDevnet111');
    expect(minted.explorerUrl).toBe('https://explorer.solana.com/tx/SigDevnet111?cluster=devnet');

    const meta = await svc.publicMetadata(first.id);
    expect(meta.properties.contentSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(meta.properties.members).toHaveLength(2);
    expect(meta.attributes.map((x) => x.trait_type)).toEqual(['plan_date', 'member_count', 'content_sha256']);

    const wallets = await getDb().select().from(userWallets).where(eq(userWallets.userId, a));
    expect(wallets).toHaveLength(1);
    expect(await svc.ensureWallet(a)).toBe(wallets[0].pubkey);
  });

  it('rejects a recap with no confirmed plan and a non-member', async () => {
    const a = await makeUser('Noor');
    const outsider = await makeUser('Out');
    const { recapId } = await savedRecap([a], { plan: false });
    await expect(svc.requestKeepsake(a, recapId)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    const ok = await savedRecap([a]);
    await expect(svc.requestKeepsake(outsider, ok.recapId)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('a failed mint stays on the keepsake row and can be retried without touching the recap', async () => {
    const a = await makeUser('Sam');
    const { recapId } = await savedRecap([a]);
    svc.setMinterForTests(async () => {
      throw new Error('rpc down');
    });
    const pending = await svc.requestKeepsake(a, recapId);
    await expect(svc.mintKeepsake(pending.id)).rejects.toThrow(/rpc down/);
    const [row] = await getDb().select().from(keepsakes).where(eq(keepsakes.id, pending.id));
    expect(row?.status).toBe('failed');
    const [recap] = await getDb().select().from(recaps).where(eq(recaps.id, recapId));
    expect(recap?.state).toBe('saved');

    svc.setMinterForTests(async () => ({ mintAddress: 'Mint2', txSignature: 'Sig2' }));
    const retry = await svc.requestKeepsake(a, recapId);
    expect(retry.id).toBe(pending.id);
    expect((await svc.mintKeepsake(retry.id)).status).toBe('minted');
  });

  it('stays off when the flag is off', async () => {
    process.env.FEATURE_KEEPSAKES = '0';
    const a = await makeUser('Off');
    const { recapId } = await savedRecap([a]);
    await expect(svc.requestKeepsake(a, recapId)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    process.env.FEATURE_KEEPSAKES = '1';
  });
});
