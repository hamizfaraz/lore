import { describe, expect, it, vi } from 'vitest';
import { PlansService, type PlansDependencies } from './service';
import type { StoredProposal } from './types';

const proposal: StoredProposal = {
  id: '00000000-0000-7000-8000-000000000101',
  conversationId: '00000000-0000-7000-8000-000000000001',
  version: 2,
  status: 'voting',
  brief: null,
  options: {
    options: [
      {
        candidateId: '00000000-0000-7000-8000-000000000201',
        headline: 'Park picnic',
        why: 'Fair and nearby',
        fitByMember: [{ userId: 'u1', fit: 'great', note: '' }],
        logistics: {},
      },
    ],
    noFeasibleOption: false,
  },
  createdBy: 'user',
  createdAt: new Date('2026-10-24T00:00:00Z'),
};

function service(overrides: Record<string, unknown> = {}) {
  const vote = vi.fn(async () => undefined);
  const store = {
    membership: vi.fn(async () => ({ role: 'member' })),
    proposal: vi.fn(async () => proposal),
    vote,
    votes: vi.fn(async () => []),
    context: vi.fn(async () => ({ conversationId: proposal.conversationId, members: [], preferences: [] })),
    candidate: vi.fn(async () => ({
      id: proposal.options.options[0]!.candidateId,
      category: 'place',
      name: 'Park picnic',
      url: 'https://example.com',
      imageUrl: null,
      address: null,
      startsAt: null,
      priceText: null,
      priceAmount: null,
      travelMinutes: null,
      rating: null,
      lastVerifiedAt: new Date(),
      source: 'seed',
      dedupeKey: 'park',
    })),
    revise: vi.fn(async (_id, options) => ({ ...proposal, version: 3, status: 'revised', options })),
    ...overrides,
  };
  const instance = new PlansService({ store, emit: vi.fn() } as unknown as PlansDependencies);
  return { instance, store, vote };
}

describe('PlansService mutations', () => {
  it('uses only the actor identity and current proposal version for an idempotent vote write', async () => {
    const { instance, vote } = service();
    await instance.vote(
      proposal.id,
      { type: 'agent', userId: 'u1', tokenId: 'token' },
      {
        candidateId: proposal.options.options[0]!.candidateId,
        response: 'yes',
      },
    );
    expect(vote).toHaveBeenCalledWith({
      proposalId: proposal.id,
      version: 2,
      userId: 'u1',
      candidateId: proposal.options.options[0]!.candidateId,
      response: 'yes',
    });
  });

  it('rejects model or client candidate ids outside the current grounded proposal', async () => {
    const { instance, vote } = service();
    await expect(
      instance.vote(
        proposal.id,
        { type: 'user', userId: 'u1' },
        { candidateId: 'invented', response: 'yes' },
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(vote).not.toHaveBeenCalled();
  });

  it('increments the proposal version on refine so earlier votes are stale', async () => {
    const { instance, store } = service();
    const result = await instance.refine(proposal.id, 'u1', { instruction: 'more outdoorsy' });
    expect(store.revise).toHaveBeenCalledOnce();
    expect(result.version).toBe(3);
    expect(store.votes).toHaveBeenCalledWith(proposal.id, 3);
  });
});
