import { eq, posts } from '@lore/db';
import { afterAll, describe, expect, it } from 'vitest';
import { closeDb, getDb } from '../../lib/db';
import { hasDb, makeGroup, makeMedia, makeUser } from '../../test/helpers';
import * as chat from '../chat/service';
import * as groups from './service';

async function crew(
  n = 4,
  policy: { mode: 'threshold' | 'unanimous' | 'direct' | 'courtesy'; threshold?: number } = {
    mode: 'threshold',
    threshold: 3,
  },
) {
  const ids = [];
  for (let i = 0; i < n; i++) ids.push(await makeUser(`U${i}`));
  const conv = await makeGroup(ids, 'Crew');
  const acct = await groups.createGroupAccount(conv, ids[0], {
    handle: `crew_${conv.slice(-8)}`,
    displayName: 'Crew',
    visibility: 'public',
    policy,
  });
  return { ids, conv, accountId: acct!.id };
}

describe.skipIf(!hasDb)('groups.service', () => {
  afterAll(() => closeDb());

  it('edit bumps version and voids approvals', async () => {
    const { ids, conv, accountId } = await crew();
    const m = await makeMedia(ids[0]);
    const d = await groups.createDraft(
      { accountId, conversationId: conv, kind: 'photo', caption: 'v1', mediaIds: [m], submit: true },
      { type: 'user', userId: ids[0] },
    );
    await groups.decide(d.id, ids[1], 'approve');
    const before = await groups.getDraft(d.id, ids[0]);
    expect(before.approvals.filter((a) => a.decision === 'approve')).toHaveLength(2); // author + 1
    const edited = await groups.patchDraft(d.id, ids[0], { caption: 'v2' });
    expect(edited.version).toBe(2);
    expect(edited.approvals).toHaveLength(0);
    expect(edited.state).toBe('submitted');
  });

  it('threshold publishes on the last approval; concurrent last approvals publish once', async () => {
    const { ids, conv, accountId } = await crew();
    const m = await makeMedia(ids[0]);
    const d = await groups.createDraft(
      { accountId, conversationId: conv, kind: 'photo', caption: 'race', mediaIds: [m], submit: true },
      { type: 'user', userId: ids[0] },
    );
    await groups.decide(d.id, ids[1], 'approve'); // 2 of 3
    const results = await Promise.all([
      groups.decide(d.id, ids[2], 'approve'),
      groups.decide(d.id, ids[3], 'approve'),
    ]);
    expect(results.some((r) => r.state === 'published')).toBe(true);
    const rows = await getDb().select().from(posts).where(eq(posts.draftId, d.id));
    expect(rows).toHaveLength(1);
  });

  it("removed member's approval no longer counts and they cannot approve", async () => {
    const { ids, conv, accountId } = await crew(4, { mode: 'threshold', threshold: 3 });
    const m = await makeMedia(ids[0]);
    const d = await groups.createDraft(
      { accountId, conversationId: conv, kind: 'photo', caption: 'x', mediaIds: [m], submit: true },
      { type: 'user', userId: ids[0] },
    );
    await groups.decide(d.id, ids[1], 'approve'); // author + ids[1] = 2
    await chat.removeMember(conv, ids[0], ids[1]);
    const after = await groups.getDraft(d.id, ids[0]);
    expect(after.approvals.map((a) => a.userId)).not.toContain(ids[1]);
    await expect(groups.decide(d.id, ids[1], 'approve')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const r = await groups.decide(d.id, ids[2], 'approve'); // author + ids[2] = 2 < 3
    expect(r.state).toBe('submitted');
  });

  it('AI-proposed draft under direct policy still requires an approval', async () => {
    const { ids, conv, accountId } = await crew(3, { mode: 'direct' });
    const m = await makeMedia(null);
    const d = await groups.createDraft(
      { accountId, conversationId: conv, kind: 'photo', caption: 'recap', mediaIds: [m], createdByAi: true },
      { type: 'system' },
    );
    expect(d.state).toBe('submitted');
    const r = await groups.decide(d.id, ids[1], 'approve');
    expect(r.state).toBe('published');
  });

  it('unanimous needs every eligible voter', async () => {
    const { ids, conv, accountId } = await crew(3, { mode: 'unanimous' });
    const m = await makeMedia(ids[0]);
    const d = await groups.createDraft(
      { accountId, conversationId: conv, kind: 'photo', caption: 'all', mediaIds: [m], submit: true },
      { type: 'user', userId: ids[0] },
    );
    expect((await groups.decide(d.id, ids[1], 'approve')).state).toBe('submitted');
    expect((await groups.decide(d.id, ids[2], 'approve')).state).toBe('published');
  });
});
