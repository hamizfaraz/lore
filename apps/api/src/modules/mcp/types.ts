import type { AuditOutcome, TokenScope } from '@lore/shared/enums';

export type McpPrincipal = {
  tokenId: string;
  userId: string;
  scopes: TokenScope[];
};

export type TokenRecord = McpPrincipal & { revokedAt: Date | null };

export type AuditRecord = {
  userId: string;
  tool: string;
  input: unknown;
  outcome: AuditOutcome;
  detail: string | null;
};
