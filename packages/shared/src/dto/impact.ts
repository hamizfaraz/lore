import { z } from 'zod';

export const zImpactSummaryDTO = z.object({
  metrics: z.array(z.object({ key: z.string(), label: z.string(), value: z.number(), unit: z.string().nullable() })),
  series: z.array(z.object({ key: z.string(), label: z.string(), points: z.array(z.object({ t: z.string(), v: z.number() })) })),
  pulse: z.string().nullable(),
  updatedAt: z.string(),
  source: z.enum(['snowflake', 'cache', 'mock']),
});
export type ImpactSummaryDTO = z.infer<typeof zImpactSummaryDTO>;
