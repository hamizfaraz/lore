import { z } from 'zod';
import { zTokenScope } from '../enums';

export const zTokenDTO = z.object({
  id: z.string(),
  name: z.string(),
  scopes: z.array(zTokenScope),
  lastUsedAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type TokenDTO = z.infer<typeof zTokenDTO>;

export const zCreateTokenBody = z.object({
  name: z.string().min(1).max(60),
  scopes: z.array(zTokenScope).min(1).default(['read']),
});
export type CreateTokenBody = z.infer<typeof zCreateTokenBody>;
/** the raw token is returned exactly once */
export const zCreateTokenResult = z.object({ token: z.string(), info: zTokenDTO });
export type CreateTokenResult = z.infer<typeof zCreateTokenResult>;

export const zTokenListDTO = z.object({ tokens: z.array(zTokenDTO) });
export type TokenListDTO = z.infer<typeof zTokenListDTO>;
