import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("should navigate between modes", async ({ page }) => {
    await page.goto("/getting-started");

    // Verify we're on getting-started
    await expect(page).toHaveURL(/getting-started/);

    // Navigate to text mode via URL (correct path is /text-input)
    await page.goto("/text-input");
    await expect(page).toHaveURL(/text-input/);

    // Navigate to audio mode via URL (correct path is /audio-input)
    await page.goto("/audio-input");
    await expect(page).toHaveURL(/audio-input/);
  });

  test("should handle invalid routes gracefully", async ({ page }) => {
    // Navigate to an invalid route
    await page.goto("/invalid-route-that-does-not-exist");

    // The app should display the default content (Getting Started)
    // even if the URL isn't redirected (due to /:mode catch-all route)
    // The main element should be visible indicating the app loaded successfully
    await expect(page.locator("main")).toBeVisible();

    // Should show Getting Started content (the default mode)
    await expect(page.locator("h1").first()).toContainText("Sarcasm Detector");
  });

  test("should preserve URL state on refresh", async ({ page }) => {
    await page.goto("/text-input");

    // Reload the page
    await page.reload();

    // Should still be on text route
    await expect(page).toHaveURL(/text-input/);
  });
});
