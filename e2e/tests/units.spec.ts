import { test, expect, uniqueName } from '../support/fixtures';
import { seedUnit } from '../support/supabase-test-user';

test.describe('יחידות', () => {
  test('מצב ריק ואז הוספת יחידה דרך הטופס', async ({ page }) => {
    await page.goto('/?view=units');
    await expect(page.getByRole('heading', { name: 'מתחילים מהיחידה הראשונה' })).toBeVisible();

    const name = uniqueName('דירה');
    // Open the add form via the header action (unique, unlike the empty-state button).
    await page.locator('[data-guide="add-unit"]').click();
    await page.getByLabel(/שם היחידה/).fill(name);
    // In the form view only the submit button carries this label.
    await page.getByRole('button', { name: 'הוספת יחידה' }).click();

    await expect(page.getByText(name)).toBeVisible();
  });

  test('עריכת שם יחידה', async ({ page }) => {
    const original = uniqueName('דירה');
    await seedUnit(original);
    await page.goto('/?view=units');
    await expect(page.getByText(original)).toBeVisible();

    await page.getByRole('button', { name: 'ערוך' }).click();
    const updated = `${original} מעודכן`;
    await page.getByLabel(/שם היחידה/).fill(updated);
    await page.getByRole('button', { name: 'שמירת שינויים' }).click();

    await expect(page.getByText(updated)).toBeVisible();
  });

  test('העברת יחידה לארכיון מחזירה למצב ריק', async ({ page }) => {
    await seedUnit(uniqueName('דירה'));
    await page.goto('/?view=units');

    await page.getByRole('button', { name: 'העבר לארכיון' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'העבר לארכיון' }).click();

    await expect(page.getByRole('heading', { name: 'מתחילים מהיחידה הראשונה' })).toBeVisible();
  });

  test('חיפוש מסנן את רשימת היחידות', async ({ page }) => {
    // Search UI appears only when there are more than 3 units.
    const unique = uniqueName('ייחודית');
    await seedUnit(unique);
    await seedUnit(uniqueName('דירה'));
    await seedUnit(uniqueName('דירה'));
    await seedUnit(uniqueName('דירה'));
    await page.goto('/?view=units');

    await page.getByLabel('חיפוש יחידות').fill(unique);
    await expect(page.getByText(unique)).toBeVisible();
    // The four generic "דירה …" cards are filtered out.
    await expect(page.getByText(/^דירה /)).toHaveCount(0);
  });
});
