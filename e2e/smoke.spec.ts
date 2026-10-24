import { expect, test } from '@playwright/test';

/**
 * End-to-end smoke (section 16). Steps 2–6 need the seed (C2-7) and C2 features; they are filled in
 * as features land. Step 1 runs as soon as auth (C1-1) exists.
 */
test('health', async ({ request }) => {
  const res = await request.get('/v1/ready');
  expect(res.ok()).toBeTruthy();
});
