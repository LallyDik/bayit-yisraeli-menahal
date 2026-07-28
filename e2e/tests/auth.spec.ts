import { test, expect } from '@playwright/test';

// Start each test signed out, regardless of the project's stored auth state.
test.use({ storageState: { cookies: [], origins: [] } });

const EMAIL = process.env.E2E_USER_EMAIL!;
const PASSWORD = process.env.E2E_USER_PASSWORD!;

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByLabel('כתובת מייל').fill(EMAIL);
  await page.getByLabel('סיסמה', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'התחבר', exact: true }).click();
}

test.describe('אימות', () => {
  test('מדף הנחיתה מציג טופס התחברות', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'מערכת ניהול שכירות לבעלי דירות' })).toBeVisible();
    await expect(page.getByLabel('כתובת מייל')).toBeVisible();
  });

  test('כניסה עם מייל וסיסמה מציגה את לוח הבקרה', async ({ page }) => {
    await signIn(page);
    await expect(page.getByRole('tab', { name: 'סקירה' })).toBeVisible();
  });

  test('התנתקות מחזירה למדף הנחיתה', async ({ page }) => {
    await signIn(page);
    await expect(page.getByRole('tab', { name: 'סקירה' })).toBeVisible();

    await page.getByRole('button', { name: 'התנתקות מהמערכת' }).click();
    await expect(page.getByRole('heading', { name: 'מערכת ניהול שכירות לבעלי דירות' })).toBeVisible();
  });
});
