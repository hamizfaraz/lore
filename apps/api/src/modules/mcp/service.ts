import type { CreateTokenBody, CreateTokenResult, TokenDTO, TokenListDTO } from '@lore/shared/dto/mcp';
import type { TokenScope } from '@lore/shared/enums';
import { z } from 'zod';
import type { Actor } from '../../lib/actor';
import { AppError, notFound, unauthorized } from '../../lib/errors';
import { createFamilyStory, generateFamilyStory } from '../family/service';
import { create as createGame } from '../games/service';
import { createDraft, submit as submitDraft } from '../groups/service';
import { proposeIntroduction } from '../discovery/service';
import { memoriesService } from '../memories/service';
import { plansService } from '../plans/service';
import {
  bearerToken,
  generatePat,
  hashPat,
  requireConfirmedWrite,
  requireScope,
  sanitizeAuditInput,
} from './policy';
import { McpRepository, mcpRepository } from './repository';
import type { AuditRecord, McpPrincipal } from './types';

const confirmed = {
  confirm: z.boolean().optional().describe('Set true only after the human explicitly confirms this write.'),
};

export const MCP_TOOLS = {
  list_groups: {
    description:
      'List the groups the connected LORE user currently belongs to. Use this to obtain a conversation id before group-scoped reads. This does not read messages or change anything.',
    scope: 'read',
    write: false,
    schema: z.object({}),
  },
  list_group_plans: {
    description:
      'List grounded plan proposals and confirmed plans for one group the user belongs to. Use this before voting. This does not create, confirm, book, or purchase a plan.',
    scope: 'read',
    write: false,
    schema: z.object({ conversationId: z.string().uuid() }),
  },
  vote_on_plan: {
    description:
      'Cast this connected user’s vote on an existing LORE plan option after explicit confirmation. This cannot vote as another member, confirm the final plan, book, or purchase anything.',
    scope: 'plans:write',
    write: true,
    schema: z.object({
      proposalId: z.string().uuid(),
      candidateId: z.string().uuid(),
      response: z.enum(['yes', 'flexible', 'no', 'veto']),
      ...confirmed,
    }),
  },
  list_events: {
    description:
      'List tentative and confirmed LORE events visible through the user’s group memberships. Optionally limit the result to one conversation. This does not modify calendars.',
    scope: 'read',
    write: false,
    schema: z.object({ conversationId: z.string().uuid().optional() }),
  },
  propose_private_recap: {
    description:
      'Create a private, consent-aware recap proposal from media already available in a group after explicit confirmation. This never publishes a post or story.',
    scope: 'drafts:write',
    write: true,
    schema: z.object({
      conversationId: z.string().uuid(),
      eventId: z.string().uuid().optional(),
      planId: z.string().uuid().optional(),
      mediaIds: z.array(z.string().uuid()).max(20).default([]),
      ...confirmed,
    }),
  },
  create_group_draft: {
    description:
      'Create an editable group-account post draft after explicit confirmation. It remains a draft and never bypasses LORE publishing policy, approval, or human publication.',
    scope: 'drafts:write',
    write: true,
    schema: z.object({
      accountId: z.string().uuid(),
      conversationId: z.string().uuid(),
      kind: z.enum(['photo', 'carousel', 'reel']),
      caption: z.string().max(2200).default(''),
      mediaIds: z.array(z.string().uuid()).min(1).max(10),
      ...confirmed,
    }),
  },
  request_group_approval: {
    description:
      'Submit an existing group draft to its normal LORE approval policy after explicit confirmation. This never approves or publishes the draft itself.',
    scope: 'drafts:write',
    write: true,
    schema: z.object({ draftId: z.string().uuid(), ...confirmed }),
  },
  create_game_lobby: {
    description:
      'Create a private LORE group game lobby after explicit confirmation. This does not start gameplay, invite outsiders, or post publicly.',
    scope: 'games:write',
    write: true,
    schema: z.object({
      conversationId: z.string().uuid(),
      game: z.enum(['one_word_story', 'meme_battle', 'pictionary']),
      ...confirmed,
    }),
  },
  get_podcast_status: {
    description:
      'Read podcast-collection and render status for a group the user belongs to. This does not record audio, finish, or publish a show.',
    scope: 'read',
    write: false,
    schema: z.object({ conversationId: z.string().uuid() }),
  },
  propose_family_story: {
    description:
      'Propose a private, source-grounded family-story draft after explicit confirmation. This never publishes the story or invents unattributed family facts.',
    scope: 'drafts:write',
    write: true,
    schema: z.object({
      conversationId: z.string().uuid(),
      title: z.string().max(120).optional(),
      ...confirmed,
    }),
  },
  propose_common_ground_introduction: {
    description:
      'Propose a consent-gated Common Ground introduction to another LORE user after explicit confirmation. This never sends an introduction or reveals private similarity signals.',
    scope: 'intros:write',
    write: true,
    schema: z.object({ targetUserId: z.string().uuid(), ...confirmed }),
  },
} as const satisfies Record<
  string,
  { description: string; scope: TokenScope; write: boolean; schema: z.ZodObject<any> }
>;

export type McpToolName = keyof typeof MCP_TOOLS;

type Store = Pick<
  McpRepository,
  | 'createToken'
  | 'listTokens'
  | 'revokeToken'
  | 'tokenByHash'
  | 'audit'
  | 'groups'
  | 'events'
  | 'podcastStatus'
>;

export type McpDependencies = {
  store: Store;
  listPlans: typeof plansService.list;
  vote: typeof plansService.vote;
  createRecap: typeof memoriesService.create;
  createDraft: typeof createDraft;
  submitDraft: typeof submitDraft;
  createGame: typeof createGame;
  createFamilyStory: typeof createFamilyStory;
  generateFamilyStory: typeof generateFamilyStory;
  proposeIntroduction: typeof proposeIntroduction;
};

const defaults: McpDependencies = {
  store: mcpRepository,
  listPlans: plansService.list.bind(plansService),
  vote: plansService.vote.bind(plansService),
  createRecap: memoriesService.create.bind(memoriesService),
  createDraft,
  submitDraft,
  createGame,
  createFamilyStory,
  generateFamilyStory,
  proposeIntroduction,
};

function tokenDto(row: {
  id: string;
  name: string;
  scopes: string[];
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}): TokenDTO {
  return {
    id: row.id,
    name: row.name,
    scopes: row.scopes as TokenScope[],
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export class McpService {
  constructor(private readonly deps: McpDependencies = defaults) {}

  async createToken(userId: string, body: CreateTokenBody): Promise<CreateTokenResult> {
    const token = generatePat();
    const row = await this.deps.store.createToken(userId, body.name.trim(), hashPat(token), body.scopes);
    return { token, info: tokenDto(row) };
  }

  async listTokens(userId: string): Promise<TokenListDTO> {
    return { tokens: (await this.deps.store.listTokens(userId)).map(tokenDto) };
  }

  async revokeToken(userId: string, tokenId: string): Promise<void> {
    if (!(await this.deps.store.revokeToken(userId, tokenId))) throw notFound('Access token not found');
  }

  async authenticate(header: string | undefined): Promise<McpPrincipal> {
    const token = bearerToken(header);
    const row = await this.deps.store.tokenByHash(hashPat(token));
    if (!row) throw unauthorized('The LORE personal access token is invalid or revoked');
    return { tokenId: row.tokenId, userId: row.userId, scopes: row.scopes };
  }

  private async audit(record: AuditRecord) {
    await this.deps.store.audit(record);
  }

  async execute(name: McpToolName, principal: McpPrincipal, rawInput: unknown): Promise<unknown> {
    const tool = MCP_TOOLS[name];
    const sanitized = sanitizeAuditInput(rawInput);
    let input: Record<string, unknown>;
    try {
      input = tool.schema.parse(rawInput) as Record<string, unknown>;
      requireScope(principal.scopes, tool.scope);
      if (tool.write) requireConfirmedWrite(input);
    } catch (error) {
      await this.audit({
        userId: principal.userId,
        tool: name,
        input: sanitized,
        outcome: 'denied',
        detail: error instanceof Error ? error.message.slice(0, 240) : 'Authorization denied',
      });
      throw error;
    }

    try {
      const result = await this.call(name, principal, input);
      await this.audit({
        userId: principal.userId,
        tool: name,
        input: sanitized,
        outcome: 'ok',
        detail: null,
      });
      return result;
    } catch (error) {
      await this.audit({
        userId: principal.userId,
        tool: name,
        input: sanitized,
        outcome: 'error',
        detail: error instanceof Error ? error.message.slice(0, 240) : 'Tool failed',
      });
      throw error;
    }
  }

  private async call(name: McpToolName, principal: McpPrincipal, input: Record<string, unknown>) {
    const agent: Actor = { type: 'agent', userId: principal.userId, tokenId: principal.tokenId };
    switch (name) {
      case 'list_groups':
        return { groups: await this.deps.store.groups(principal.userId) };
      case 'list_group_plans':
        return this.deps.listPlans(input.conversationId as string, principal.userId);
      case 'vote_on_plan':
        return this.deps.vote(input.proposalId as string, agent, {
          candidateId: input.candidateId as string,
          response: input.response as 'yes' | 'flexible' | 'no' | 'veto',
        });
      case 'list_events':
        return {
          events: await this.deps.store.events(principal.userId, input.conversationId as string | undefined),
        };
      case 'propose_private_recap':
        return this.deps.createRecap(input.conversationId as string, principal.userId, {
          eventId: input.eventId as string | undefined,
          planId: input.planId as string | undefined,
          mediaIds: input.mediaIds as string[],
        });
      case 'create_group_draft':
        return this.deps.createDraft(
          {
            accountId: input.accountId as string,
            conversationId: input.conversationId as string,
            kind: input.kind as 'photo' | 'carousel' | 'reel',
            caption: input.caption as string,
            mediaIds: input.mediaIds as string[],
            createdByAi: true,
            submit: false,
            source: { kind: 'manual' },
          },
          agent,
        );
      case 'get_podcast_status':
        return {
          shows: await this.deps.store.podcastStatus(principal.userId, input.conversationId as string),
        };
      case 'request_group_approval':
        return this.deps.submitDraft(input.draftId as string, agent);
      case 'create_game_lobby':
        return this.deps.createGame(principal.userId, {
          conversationId: input.conversationId as string,
          mode: input.game as 'one_word_story' | 'meme_battle' | 'pictionary',
          config: {},
        });
      case 'propose_family_story': {
        const to = new Date();
        const from = new Date(to.getTime() - 30 * 86_400_000);
        const story = await this.deps.createFamilyStory(input.conversationId as string, principal.userId, {
          from: from.toISOString(),
          to: to.toISOString(),
        });
        try {
          return await this.deps.generateFamilyStory(story.id, principal.userId);
        } catch (error) {
          return { story, generateError: error instanceof Error ? error.message : 'generation failed' };
        }
      }
      case 'propose_common_ground_introduction':
        return this.deps.proposeIntroduction(principal.userId, input.targetUserId as string);
      default:
        throw new AppError('NOT_FOUND', 'Unknown MCP tool');
    }
  }
}

export const mcpService = new McpService();
export const createToken = mcpService.createToken.bind(mcpService);
export const listTokens = mcpService.listTokens.bind(mcpService);
export const revokeToken = mcpService.revokeToken.bind(mcpService);
