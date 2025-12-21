import { expect, test } from '@playwright/test';

// Use a desktop viewport to test routing (routing is disabled on mobile/tablet)
// The app's tablet breakpoint is 1440px (TABLET_BREAKPOINT)
// Desktop is >= 1440px
test.use({ viewport: { width: 1500, height: 900 } });

test.describe('Navigation (Desktop)', () => {
  test('should navigate between modes', async ({ page }) => {
    await page.goto('/getting-started');

    // Verify we're on getting-started
    await expect(page).toHaveURL(/getting-started/);
    await expect(page.getByTestId('getting-started')).toBeVisible();

    // Navigate to text mode via URL (correct path is /text-input)
    await page.goto('/text-input');
    await expect(page).toHaveURL(/text-input/);
    await expect(page.getByTestId('text-input')).toBeVisible();

    // Navigate to audio mode via URL (correct path is /audio-input)
    await page.goto('/audio-input');
    await expect(page).toHaveURL(/audio-input/);
    await expect(page.getByTestId('audio-recorder')).toBeVisible();
  });

  test('should handle invalid routes gracefully', async ({ page }) => {
    // Navigate to an invalid route
    await page.goto('/invalid-route-that-does-not-exist');

    // The app should display the default content (Getting Started)
    // even if the URL isn't redirected (due to /:mode catch-all route)
    // The main element should be visible indicating the app loaded successfully
    await expect(page.getByTestId('app-main')).toBeVisible();

    // Should show Getting Started content (the default mode)
    await expect(page.getByTestId('app-title')).toContainText(
      'Sarcasm Detector'
    );
  });

  test('should preserve URL state on refresh', async ({ page }) => {
    await page.goto('/text-input');

    // Reload the page
    await page.reload();

    // Should still be on text route
    await expect(page).toHaveURL(/text-input/);
    await expect(page.getByTestId('text-input')).toBeVisible();
  });
});

test.describe('Navigation (Mobile/Tablet - Routing Disabled)', () => {
  // Use mobile viewport to test that routing is disabled
  test.use({ viewport: { width: 768, height: 1024 } });

  test('should redirect all routes to root on mobile/tablet', async ({
    page,
  }) => {
    // Try navigating to different routes
    await page.goto('/text-input');
    // Should redirect to root
    await expect(page).toHaveURL('/');

    await page.goto('/audio-input');
    // Should redirect to root
    await expect(page).toHaveURL('/');

    await page.goto('/getting-started');
    // Should redirect to root
    await expect(page).toHaveURL('/');
  });

  test('should show mobile controls on root page', async ({ page }) => {
    await page.goto('/');

    // Mobile input controls should be visible
    await expect(page.getByTestId('mobile-input-controls')).toBeVisible();

    // Detection mode switch should be visible
    await expect(page.getByTestId('detection-mode-switch')).toBeVisible();
  });
});
