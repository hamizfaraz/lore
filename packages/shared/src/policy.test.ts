import { describe, expect, it } from 'vitest';
import { type Approval, type DraftForPolicy, canFinishPodcast, mayPublish } from './policy';

const voters = ['a', 'b', 'c', 'd'];
const draft = (mode: DraftForPolicy['policySnapshot']['mode'], extra: Partial<DraftForPolicy> = {}): DraftForPolicy => ({
  version: 2,
  createdByAi: false,
  policySnapshot: { mode, threshold: mode === 'threshold' ? 3 : null, eligibleVoterIds: voters },
  ...extra,
});
const ok = (userId: string, version = 2): Approval => ({ userId, version, decision: 'approve' });
const actor = { userId: 'a', canDirect: true };

describe('mayPublish', () => {
  it('direct: eligible member publishes immediately', () => {
    expect(mayPublish(draft('direct'), [], actor)).toBe(true);
    expect(mayPublish(draft('direct'), [], { userId: 'z', canDirect: false })).toBe(false);
  });

  it('courtesy: behaves like direct for the author', () => {
    expect(mayPublish(draft('courtesy'), [], actor)).toBe(true);
  });

  it('threshold: below, at, above', () => {
    expect(mayPublish(draft('threshold'), [ok('a'), ok('b')], actor)).toBe(false);
    expect(mayPublish(draft('threshold'), [ok('a'), ok('b'), ok('c')], actor)).toBe(true);
    expect(mayPublish(draft('threshold'), [ok('a'), ok('b'), ok('c'), ok('d')], actor)).toBe(true);
  });

  it('unanimous: one missing, all present', () => {
    expect(mayPublish(draft('unanimous'), [ok('a'), ok('b'), ok('c')], actor)).toBe(false);
    expect(mayPublish(draft('unanimous'), voters.map((v) => ok(v)), actor)).toBe(true);
  });

  it('stale version approvals do not count', () => {
    expect(mayPublish(draft('threshold'), [ok('a', 1), ok('b', 1), ok('c', 1)], actor)).toBe(false);
  });

  it('non-eligible voter does not count', () => {
    expect(mayPublish(draft('threshold'), [ok('a'), ok('b'), ok('x')], actor)).toBe(false);
  });

  it('request_changes does not count as approval', () => {
    const a: Approval[] = [ok('a'), ok('b'), { userId: 'c', version: 2, decision: 'request_changes' }];
    expect(mayPublish(draft('threshold'), a, actor)).toBe(false);
  });

  it('AI-created draft under direct still requires an approval', () => {
    const d = draft('direct', { createdByAi: true });
    expect(mayPublish(d, [], actor)).toBe(false);
    expect(mayPublish(d, [ok('b')], actor)).toBe(true);
  });
});

describe('canFinishPodcast', () => {
  const req = ['a', 'b', 'c'];
  it('not wrapped', () => {
    expect(canFinishPodcast({ wrapped: false, requiredParticipantIds: req, engagedUserIds: req })).toBe(false);
  });
  it('one missing participant', () => {
    expect(canFinishPodcast({ wrapped: true, requiredParticipantIds: req, engagedUserIds: ['a', 'b'] })).toBe(false);
  });
  it('all engaged', () => {
    expect(canFinishPodcast({ wrapped: true, requiredParticipantIds: req, engagedUserIds: req })).toBe(true);
  });
});
