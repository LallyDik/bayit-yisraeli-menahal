import { test as setup, expect } from '@playwright/test';
import { signInTestUser, resetTestUserData, TEST_USER } from './support/supabase-test-user';

const AUTH_FILE = 'e2e/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Ensure the test user exists (created on first run) and start from a clean slate.
  await signInTestUser();
  await resetTestUserData();

  await page.goto('/');
  await page.getByLabel('כתובת מייל').fill(TEST_USER.email);
  await page.getByLabel('סיסמה', { exact: true }).fill(TEST_USER.password);
  await page.getByRole('button', { name: 'התחבר', exact: true }).click();

  // The signed-in shell renders the main tabs only for an authenticated user.
  await expect(page.getByRole('tab', { name: 'סקירה' })).toBeVisible();

  await page.context().storageState({ path: AUTH_FILE });
});
