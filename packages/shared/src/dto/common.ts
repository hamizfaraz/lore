import { z } from 'zod';

export const zCursorQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
export type CursorQuery = z.infer<typeof zCursorQuery>;

export const zPage = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ items: z.array(item), nextCursor: z.string().nullable() });
export type Page<T> = { items: T[]; nextCursor: string | null };

export const zErrorDTO = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
export type ErrorDTO = z.infer<typeof zErrorDTO>;

export const zOk = z.object({ ok: z.literal(true) });
export const zIdParams = z.object({ id: z.string() });
