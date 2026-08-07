import { expect, test, bootAuthenticated } from './helpers';

test.describe('food search (offline)', () => {
  test('search tab renders cached-first and shows the offline banner', async ({
    page,
  }) => {
    await bootAuthenticated(page);

    await page.getByText('Search', { exact: true }).click();
    await expect(page.getByText('Search foods', { exact: true })).toBeVisible();

    await page.getByPlaceholder('Search YAZIO foods...').fill('oats');
    // No YAZIO in tests → remote fails, offline banner appears, cached list stays usable.
    // (Both the dashboard and this tab may show the banner — assert the first.)
    await expect(page.getByText(/YAZIO unavailable/i).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test('log-meal modal opens from the dashboard and can close', async ({ page }) => {
    await bootAuthenticated(page);

    await page.getByRole('button', { name: 'Add food to Breakfast' }).click();
    // The modal title (the dashboard card behind it also says "Breakfast" — scope to the modal).
    await expect(page.getByRole('button', { name: 'More' })).toBeVisible();
    await expect(
      page.getByPlaceholder('What did you have for breakfast?'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByText('Meals', { exact: true })).toBeVisible();
  });

  test('settings screen renders goals, sync, and data sections', async ({ page }) => {
    await bootAuthenticated(page);

    await page.getByText('Settings', { exact: true }).click();
    await expect(page.getByText('Daily goals', { exact: true })).toBeVisible();
    await expect(page.getByText('Calories (kcal)')).toBeVisible();
    await expect(page.getByText('YAZIO sync', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  });
});
