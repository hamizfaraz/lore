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
  scopes: z.array(zTokenScope).optional(),
});
/** the raw token is returned exactly once */
export const zCreateTokenResult = z.object({ token: z.string(), info: zTokenDTO });
