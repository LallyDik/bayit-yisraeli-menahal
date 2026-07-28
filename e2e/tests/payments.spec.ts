import { test, expect, uniqueName } from '../support/fixtures';
import { seedActiveTenancy } from '../support/supabase-test-user';

test.describe('תשלומים', () => {
  test('סימון שכר דירה כשולם — תווית לפי אמצעי תשלום (העברה)', async ({ page }) => {
    await seedActiveTenancy({
      unitName: uniqueName('דירה'),
      tenantName: uniqueName('שוכר'),
      rent: 3000,
      method: 'transfer',
    });
    await page.goto('/?view=payments');

    const markBtn = page.locator('[data-guide="rent-mark-paid"]');
    await expect(markBtn).toBeVisible();
    await expect(markBtn).toContainText('בוצעה העברה');

    await markBtn.click();

    // Fully paid → the action disables itself and nothing remains due.
    await expect(page.locator('[data-guide="rent-mark-paid"]')).toBeDisabled();
    await expect(page.getByText('נשאר ₪0')).toBeVisible();
  });

  test("תווית „הופקד צ'ק” כשאמצעי התשלום הוא צ'ק", async ({ page }) => {
    await seedActiveTenancy({
      unitName: uniqueName('דירה'),
      tenantName: uniqueName('שוכר'),
      rent: 3000,
      method: 'check',
    });
    await page.goto('/?view=payments');
    await expect(page.locator('[data-guide="rent-mark-paid"]')).toContainText("הופקד צ'ק");
  });

  test('תווית ברירת מחדל „סמן כשולם” כשאין אמצעי תשלום', async ({ page }) => {
    await seedActiveTenancy({
      unitName: uniqueName('דירה'),
      tenantName: uniqueName('שוכר'),
      rent: 3000,
      method: null,
    });
    await page.goto('/?view=payments');
    await expect(page.locator('[data-guide="rent-mark-paid"]')).toContainText('סמן כשולם');
  });

  test('תשלום חלקי מעדכן את היתרה', async ({ page }) => {
    await seedActiveTenancy({
      unitName: uniqueName('דירה'),
      tenantName: uniqueName('שוכר'),
      rent: 3000,
      method: null,
    });
    await page.goto('/?view=payments');

    await page.locator('[data-guide="rent-partial"]').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('עדכון תשלום')).toBeVisible();
    await dialog.getByLabel('שולם עד עכשיו').fill('1000');
    await dialog.getByRole('button', { name: 'שמור תשלום' }).click();

    // 3000 − 1000 = 2000 remaining on the rent card.
    await expect(page.getByText('נשאר ₪2,000')).toBeVisible();
  });
});
