import { describe, expect, it, vi } from 'vitest';
import { generatePat, hashPat } from './policy';
import { MCP_TOOLS, McpService, type McpDependencies } from './service';
import type { AuditRecord, McpPrincipal } from './types';

const userId = '00000000-0000-7000-8000-000000000001';
const tokenId = '00000000-0000-7000-8000-000000000002';
const conversationId = '00000000-0000-7000-8000-000000000003';
const proposalId = '00000000-0000-7000-8000-000000000004';
const candidateId = '00000000-0000-7000-8000-000000000005';

function setup() {
  const audits: AuditRecord[] = [];
  const vote = vi.fn(async () => ({ id: proposalId }));
  const createRecap = vi.fn(async () => ({ id: 'recap', state: 'ready_private' }));
  const createDraft = vi.fn(async () => {
    throw new Error('draft backend unavailable');
  });
  const store = {
    createToken: vi.fn(async (_owner, name, _hash, scopes) => ({
      id: tokenId,
      userId,
      name,
      tokenHash: 'stored-hash',
      scopes,
      lastUsedAt: null,
      revokedAt: null,
      createdAt: new Date('2026-10-24T00:00:00Z'),
    })),
    listTokens: vi.fn(async () => []),
    revokeToken: vi.fn(async () => true),
    tokenByHash: vi.fn(async () => null),
    audit: vi.fn(async (record: AuditRecord) => {
      audits.push(record);
    }),
    groups: vi.fn(async () => []),
    events: vi.fn(async () => []),
    podcastStatus: vi.fn(async () => []),
  };
  const service = new McpService({
    store,
    listPlans: vi.fn(async () => ({ proposals: [], confirmed: [], preferences: [] })),
    vote,
    createRecap,
    createDraft,
  } as unknown as McpDependencies);
  return { service, store, audits, vote, createRecap, createDraft };
}

const principal = (scopes: McpPrincipal['scopes']): McpPrincipal => ({ tokenId, userId, scopes });

describe('MCP service', () => {
  it('advertises every required model-readable tool', () => {
    expect(Object.keys(MCP_TOOLS)).toEqual([
      'list_groups',
      'list_group_plans',
      'vote_on_plan',
      'list_events',
      'propose_private_recap',
      'create_group_draft',
      'request_group_approval',
      'create_game_lobby',
      'get_podcast_status',
      'propose_family_story',
      'propose_common_ground_introduction',
    ]);
    for (const tool of Object.values(MCP_TOOLS)) expect(tool.description.length).toBeGreaterThan(80);
  });

  it('returns the raw PAT once while handing only its SHA-256 hash to storage', async () => {
    const { service, store } = setup();
    const result = await service.createToken(userId, { name: 'Muse', scopes: ['read'] });
    expect(result.token).toMatch(/^lore_pat_[A-Za-z0-9]{32}$/);
    expect(store.createToken).toHaveBeenCalledWith(userId, 'Muse', hashPat(result.token), ['read']);
    expect(JSON.stringify(store.createToken.mock.calls)).not.toContain(result.token);
  });

  it('returns 401 semantics for invalid and revoked tokens', async () => {
    const { service, store } = setup();
    await expect(service.authenticate('Bearer invalid')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    const token = generatePat();
    store.tokenByHash.mockResolvedValueOnce(null);
    await expect(service.authenticate(`Bearer ${token}`)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects missing confirmation and scope violations and audits each denial', async () => {
    const { service, audits } = setup();
    await expect(
      service.execute('vote_on_plan', principal(['plans:write']), {
        proposalId,
        candidateId,
        response: 'yes',
      }),
    ).rejects.toBeDefined();
    await expect(
      service.execute('vote_on_plan', principal(['read']), {
        proposalId,
        candidateId,
        response: 'yes',
        confirm: true,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(audits.map((row) => row.outcome)).toEqual(['denied', 'denied']);
  });

  it('casts votes only with the token owner identity and audits success', async () => {
    const { service, vote, audits } = setup();
    await service.execute('vote_on_plan', principal(['plans:write']), {
      proposalId,
      candidateId,
      response: 'flexible',
      confirm: true,
      userId: 'attacker-controlled',
    });
    expect(vote).toHaveBeenCalledWith(
      proposalId,
      { type: 'agent', userId, tokenId },
      { candidateId, response: 'flexible' },
    );
    expect(audits.at(-1)).toMatchObject({ tool: 'vote_on_plan', outcome: 'ok', userId });
  });

  it('creates only a private recap proposal through the recap service', async () => {
    const { service, createRecap, createDraft } = setup();
    await service.execute('propose_private_recap', principal(['drafts:write']), {
      conversationId,
      mediaIds: [],
      confirm: true,
    });
    expect(createRecap).toHaveBeenCalledWith(conversationId, userId, {
      eventId: undefined,
      planId: undefined,
      mediaIds: [],
    });
    expect(createDraft).not.toHaveBeenCalled();
  });

  it('audits tool errors without retaining token or caption material', async () => {
    const { service, audits } = setup();
    const rawToken = generatePat();
    await expect(
      service.execute('create_group_draft', principal(['drafts:write']), {
        accountId: '00000000-0000-7000-8000-000000000006',
        conversationId,
        kind: 'photo',
        caption: `private ${rawToken}`,
        mediaIds: ['00000000-0000-7000-8000-000000000007'],
        confirm: true,
      }),
    ).rejects.toThrow('draft backend unavailable');
    const audit = audits.at(-1)!;
    expect(audit.outcome).toBe('error');
    expect(JSON.stringify(audit)).not.toContain(rawToken);
    expect(audit.input).toMatchObject({ caption: '[redacted]' });
  });
});
