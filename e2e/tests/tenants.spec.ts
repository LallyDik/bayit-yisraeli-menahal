import { test, expect, uniqueName } from '../support/fixtures';
import { seedUnit, seedTenant } from '../support/supabase-test-user';

test.describe('שוכרים', () => {
  test('הוספת שוכר עם שיוך ליחידה, שכר דירה ואמצעי תשלום', async ({ page }) => {
    const unitName = uniqueName('דירה');
    await seedUnit(unitName);
    const tenantName = uniqueName('שוכר');

    await page.goto('/?view=tenants');
    await page.locator('[data-guide="add-tenant"]').click();

    await page.getByLabel(/שם השוכר/).fill(tenantName);

    // Assign the unit (Radix Select → listbox options).
    await page.getByLabel('יחידה', { exact: true }).click();
    await page.getByRole('option', { name: unitName }).click();

    await page.getByLabel(/שכר דירה חודשי/).fill('3000');

    await page.getByLabel(/אופן תשלום/).click();
    await page.getByRole('option', { name: 'העברה בנקאית' }).click();

    // In the form view only the submit button carries this label.
    await page.getByRole('button', { name: 'הוספת שוכר' }).click();

    // The tenant card shows the name and the assigned unit.
    await expect(page.getByText(tenantName)).toBeVisible();
    await expect(page.getByText(unitName)).toBeVisible();
  });

  test('העברת שוכר לארכיון מחזירה למצב ריק', async ({ page }) => {
    await seedTenant(uniqueName('שוכר'));
    await page.goto('/?view=tenants');

    await page.getByRole('button', { name: 'העבר לארכיון' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'העבר לארכיון' }).click();

    await expect(page.getByRole('heading', { name: 'מוסיפים את השוכר הראשון' })).toBeVisible();
  });
});
