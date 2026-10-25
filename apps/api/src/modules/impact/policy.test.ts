import { describe, expect, it } from 'vitest';
import { sanitizeImpactEvent } from './policy';

describe('impact event privacy policy', () => {
  it('allows known event kinds while removing raw ids, text, and unknown props', () => {
    const event = sanitizeImpactEvent(
      {
        kind: 'plan_confirmed',
        groupId: 'group-real-id',
        actorId: 'person@example.com',
        objectId: 'proposal-real-id',
        props: {
          voteCount: 3,
          intentToConfirmMs: 88_000,
          message: 'private chat text',
          userId: 'raw-user',
        },
      },
      'test-salt',
    );
    const snapshot = JSON.stringify(event);
    expect(event.props).toMatchObject({ voteCount: 3, intentToConfirmMs: 88_000 });
    expect(event.groupHash).toMatch(/^[a-f0-9]{64}$/);
    expect(snapshot).not.toContain('group-real-id');
    expect(snapshot).not.toContain('person@example.com');
    expect(snapshot).not.toContain('proposal-real-id');
    expect(snapshot).not.toContain('private chat text');
    expect(snapshot).not.toContain('raw-user');
  });

  it('rejects events outside the fixed allowlist', () => {
    expect(() => sanitizeImpactEvent({ kind: 'message_text' } as never, 'salt')).toThrow(
      'Unsupported impact event kind',
    );
  });
});
