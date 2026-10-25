import { afterAll, describe, expect, it } from 'vitest';
import { closeDb } from '../../lib/db';
import { hasDb, makeGroup, makeUser } from '../../test/helpers';
import * as chat from './service';

describe.skipIf(!hasDb)('chat.service', () => {
  afterAll(() => closeDb());

  it('idempotent send with the same clientId returns the first message', async () => {
    const a = await makeUser('Ava');
    const b = await makeUser('Leo');
    const conv = await makeGroup([a, b]);
    const first = await chat.postMessage(
      conv,
      { kind: 'text', body: 'hi', clientId: 'c-1' },
      { type: 'user', userId: a },
    );
    const again = await chat.postMessage(
      conv,
      { kind: 'text', body: 'hi', clientId: 'c-1' },
      { type: 'user', userId: a },
    );
    expect(again.id).toBe(first.id);
    const page = await chat.listMessages(conv, a);
    expect(page.items.filter((m) => m.clientId === 'c-1')).toHaveLength(1);
  });

  it('non-member gets 403', async () => {
    const a = await makeUser('Ava');
    const outsider = await makeUser('Zed');
    const conv = await makeGroup([a]);
    await expect(
      chat.postMessage(conv, { kind: 'text', body: 'let me in' }, { type: 'user', userId: outsider }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(chat.listMessages(conv, outsider)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('removed member gets 403 afterwards', async () => {
    const a = await makeUser('Ava');
    const b = await makeUser('Leo');
    const conv = await makeGroup([a, b]);
    await chat.removeMember(conv, a, b);
    await expect(chat.listMessages(conv, b)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it("hidden-history members' text is excluded from the AI context builder", async () => {
    const a = await makeUser('Ava');
    const b = await makeUser('Noor');
    const conv = await makeGroup([a, b]);
    await chat.setAiConsent(conv, b, false);
    await chat.postMessage(conv, { kind: 'text', body: 'public plan talk' }, { type: 'user', userId: a });
    await chat.postMessage(conv, { kind: 'text', body: 'my private secret' }, { type: 'user', userId: b });
    const t = await chat.transcriptForAi(conv);
    expect(t.map((x) => x.text)).toContain('public plan talk');
    expect(t.map((x) => x.text).join(' ')).not.toContain('private secret');
    expect(t.find((x) => x.senderUserId === b)?.text).toBe('[message hidden from AI]');
  });
});
