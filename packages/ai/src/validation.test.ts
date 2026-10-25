import { describe, expect, it } from 'vitest';

import { assertRecapReferences, sanitizePlanRanking, sanitizeSpeakDecision } from './validation.js';

describe('model reference validation', () => {
  it('drops unknown ids and forces unverified news to silence', () => {
    const sanitized = sanitizeSpeakDecision(
      {
        speak: true,
        intent: 'news',
        candidateId: 'invented',
        memoryIdsUsed: ['known-memory', 'invented-memory'],
        newMemories: [{ subjectUserIds: ['known-user', 'invented-user'], summary: 'safe' }],
        events: [{ sourceMessageIds: ['known-message', 'invented-message'], title: 'event' }],
      },
      {
        memoryIds: ['known-memory'],
        candidateIds: ['known-candidate'],
        messageIds: ['known-message'],
        userIds: ['known-user'],
      },
    );

    expect(sanitized.speak).toBe(false);
    expect(sanitized.candidateId).toBeUndefined();
    expect(sanitized.memoryIdsUsed).toEqual(['known-memory']);
    expect(sanitized.newMemories?.[0]?.subjectUserIds).toEqual(['known-user']);
    expect(sanitized.events?.[0]?.sourceMessageIds).toEqual(['known-message']);
  });

  it('drops plan options and member-fit ids outside the supplied sets', () => {
    const sanitized = sanitizePlanRanking(
      {
        options: [
          {
            candidateId: 'known-candidate',
            fitByMember: [{ userId: 'known-user' }, { userId: 'invented-user' }],
          },
          { candidateId: 'invented-candidate', fitByMember: [] },
        ],
      },
      { candidateIds: ['known-candidate'], userIds: ['known-user'] },
    );

    expect(sanitized.options).toEqual([
      { candidateId: 'known-candidate', fitByMember: [{ userId: 'known-user' }] },
    ]);
  });

  it('rejects recap facts and media that were not supplied to the model', () => {
    const recap = {
      orderedMediaIds: ['known-media'],
      coverMediaId: 'known-media',
      factsUsed: [{ sourceMessageId: 'invented-message', claim: 'invented' }],
    };
    expect(() =>
      assertRecapReferences(recap, {
        mediaIds: ['known-media'],
        messageIds: ['known-message'],
      }),
    ).toThrow('unknown message id');
  });
});
