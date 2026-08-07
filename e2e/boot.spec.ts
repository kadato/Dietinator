import { expect, test } from './helpers';

test.describe('app boot', () => {
  test('shows the login screen when not signed in', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Dietinator', { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.getByRole('button', { name: /Sign in with YAZIO/i }),
    ).toBeVisible();
  });

  test('boots straight into the diary with a seeded session', async ({ page }) => {
    await page.addInitScript((key) => {
      localStorage.setItem(key, '1');
    }, 'calorie_tracker_yazio_logged_in');
    await page.goto('/');

    await expect(page.getByText('Meals', { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    // Fully usable without YAZIO — local-first. (No banner on boot: nothing has failed yet.)
    await expect(page.getByText('Breakfast', { exact: true })).toBeVisible();
    await expect(page.getByText('Lunch', { exact: true })).toBeVisible();
    await expect(page.getByText('Dinner', { exact: true })).toBeVisible();
  });
});
