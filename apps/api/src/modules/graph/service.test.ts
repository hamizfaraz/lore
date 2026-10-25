import { account as authAccounts, eq, facebookImports, interestProfiles } from '@lore/db';
import { uuidv7 } from '@lore/shared/ids';
import { afterAll, describe, expect, it } from 'vitest';
import { closeDb, getDb } from '../../lib/db';
import { hasDb, makeUser } from '../../test/helpers';
import type { GraphProfile } from './facebook';
import * as graph from './service';

function graphProfile(over: Partial<GraphProfile> = {}): GraphProfile {
  return {
    id: 'fb-default',
    name: 'Tester',
    pictureUrl: null,
    grantedScopes: ['public_profile', 'email', 'user_friends'],
    likes: [],
    friendIds: [],
    ...over,
  };
}

describe.skipIf(!hasDb)('graph.service', () => {
  afterAll(() => closeDb());

  it('maps likes to tags and shows a friend who also imported, in both directions', async () => {
    const a = await makeUser('Ava');
    const b = await makeUser('Leo');
    const aRes = await graph.importGraph(
      a,
      graphProfile({
        id: `fb-${a.slice(-6)}`,
        likes: [
          { id: '1', name: 'Dune', category: 'Movie' },
          { id: '2', name: 'The Bear', category: 'TV Show' },
          { id: '3', name: 'Local Band', category: 'Musician/Band' },
        ],
        friendIds: [`fb-${b.slice(-6)}`],
        grantedScopes: ['public_profile', 'email', 'user_likes', 'user_friends'],
      }),
    );
    expect(aRes.suggestedTags.map((t) => t.tag)).toEqual(['film-tv', 'live-music']);
    expect(aRes.suggestedTags.every((t) => t.from === 'facebook')).toBe(true);
    expect(aRes.friendsOnLore).toHaveLength(0);

    const bRes = await graph.importGraph(
      b,
      graphProfile({
        id: `fb-${b.slice(-6)}`,
        friendIds: [`fb-${a.slice(-6)}`],
        likes: [],
        grantedScopes: ['public_profile', 'email', 'user_friends'],
      }),
    );
    expect(bRes.suggestedTags).toEqual([]);
    expect(bRes.friendsOnLore.map((f) => f.displayName)).toContain('Ava');
    expect(bRes.friendsOnLore[0].following).toBe(false);

    const again = await graph.connections(a);
    expect(again.friendsOnLore?.map((f) => f.displayName)).toContain('Leo');
    expect(again.facebook?.grantedScopes).toContain('user_likes');
  });

  it('declining user_likes still imports and leaves suggested tags empty', async () => {
    const id = await makeUser('NoLikes');
    const res = await graph.importGraph(
      id,
      graphProfile({
        id: `fb-${id.slice(-6)}`,
        likes: [],
        grantedScopes: ['public_profile', 'email'],
        friendIds: ['fb-nobody'],
      }),
    );
    expect(res.suggestedTags).toEqual([]);
    expect(res.friendsOnLore).toEqual([]);
    expect(res.grantedScopes).not.toContain('user_likes');
  });

  it('confirm keeps only tags that came from the import', async () => {
    const id = await makeUser('Picker');
    await graph.importGraph(
      id,
      graphProfile({
        id: `fb-${id.slice(-6)}`,
        likes: [{ id: '1', name: 'Dune', category: 'Movie' }],
      }),
    );
    const kept = await graph.confirmSuggestions(id, ['film-tv', 'not-from-facebook']);
    expect(kept.tags.map((t) => t.tag)).toEqual(['film-tv']);
  });

  it('disconnect deletes the import, the token, and graph-sourced tags', async () => {
    const id = await makeUser('Bye');
    const fbId = `fb-${id.slice(-6)}`;
    await graph.importGraph(
      id,
      graphProfile({
        id: fbId,
        likes: [
          { id: '1', name: 'Dune', category: 'Movie' },
          { id: '2', name: 'Band', category: 'Musician/Band' },
        ],
      }),
    );
    await getDb().insert(authAccounts).values({
      id: uuidv7(),
      accountId: fbId,
      providerId: 'facebook',
      userId: id,
      accessToken: 'test-token',
      scope: 'public_profile,email,user_likes',
    });
    await getDb()
      .insert(interestProfiles)
      .values({
        userId: id,
        explicitTags: ['film-tv', 'cooking'],
        inferred: { 'live-music': 0.5, cooking: 0.2 },
      })
      .onConflictDoUpdate({
        target: interestProfiles.userId,
        set: {
          explicitTags: ['film-tv', 'cooking'],
          inferred: { 'live-music': 0.5, cooking: 0.2 },
        },
      });

    await graph.disconnect(id);

    const [row] = await getDb().select().from(facebookImports).where(eq(facebookImports.userId, id));
    expect(row).toBeUndefined();
    const [auth] = await getDb().select().from(authAccounts).where(eq(authAccounts.userId, id));
    expect(auth).toBeUndefined();
    const [profile] = await getDb().select().from(interestProfiles).where(eq(interestProfiles.userId, id));
    expect(profile?.explicitTags).toEqual(['cooking']);
    expect(profile?.inferred).toEqual({ cooking: 0.2 });
    const after = await graph.connections(id);
    expect(after.facebook).toBeNull();
  });
});
