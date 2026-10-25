import { expect, test } from '@playwright/test';

/**
 * End-to-end smoke (section 16). Steps 2–6 need the seed (C2-7) and C2 features; they are filled in
 * as features land. Step 1 runs as soon as auth (C1-1) exists.
 */
test('health', async ({ request }) => {
  const res = await request.get('/v1/ready');
  expect(res.ok()).toBeTruthy();
});

test('signed-in home, chat, and find friends', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('Email').fill(process.env.E2E_EMAIL ?? 'ava.demo@ourlore.test');
  await page.getByPlaceholder('Password').fill(process.env.E2E_PASSWORD ?? 'password123');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();
  await page.goto('/c/00000000-0000-7000-8000-000000000201');
  await expect(page.getByRole('textbox', { name: 'Message' })).toBeVisible();
  await page.goto('/find-friends');
  await expect(page.getByRole('heading', { name: 'Common Ground' })).toBeVisible();
});

test('an unsigned family or podcast visit returns to login', async ({ page }) => {
  await page.goto('/family/00000000-0000-7000-8000-000000000099');
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  await page.goto('/podcast/00000000-0000-7000-8000-000000000099');
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
});
