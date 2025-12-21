import { expect, test } from '@playwright/test';

test.describe('Sarcasm Detector App', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/');

    // Should have the title
    await expect(page.getByTestId('app-title')).toContainText(
      'Sarcasm Detector'
    );
  });

  test('should redirect root to getting-started on desktop', async ({
    page,
  }) => {
    // Use desktop viewport
    await page.setViewportSize({ width: 1500, height: 900 });
    await page.goto('/');

    // Should redirect to getting-started route on desktop
    await expect(page).toHaveURL(/getting-started/);
  });

  test('should stay on root on mobile/tablet (routing disabled)', async ({
    page,
  }) => {
    // Use mobile viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');

    // Should stay on root (routing is disabled on mobile/tablet)
    // Wait for RouteSync to redirect /getting-started back to /
    await page.waitForURL('/', { timeout: 5000 });
    await expect(page).toHaveURL('/');

    // Mobile controls should be visible
    await expect(page.getByTestId('mobile-input-controls')).toBeVisible();
  });

  test('should display the meter section', async ({ page }) => {
    await page.goto('/');

    // The meter section should be visible
    await expect(page.getByTestId('app-main')).toBeVisible();
    await expect(page.getByTestId('meter')).toBeVisible();
  });
});
