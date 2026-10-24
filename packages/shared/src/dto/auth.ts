import { z } from 'zod';

/** Better Auth owns /api/auth/*; these are LORE's own onboarding shapes. */
export const zSignupBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(60),
});
export type SignupBody = z.infer<typeof zSignupBody>;
