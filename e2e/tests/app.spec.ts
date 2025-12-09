import { test, expect } from "@playwright/test";

test.describe("Sarcasm Detector App", () => {
  test("should load the homepage", async ({ page }) => {
    await page.goto("/");

    // Should have the title
    await expect(page.getByTestId("app-title")).toContainText(
      "Sarcasm Detector",
    );
  });

  test("should redirect root to getting-started", async ({ page }) => {
    await page.goto("/");

    // Should redirect to getting-started route
    await expect(page).toHaveURL(/getting-started/);
  });

  test("should display the meter section", async ({ page }) => {
    await page.goto("/");

    // The meter section should be visible
    await expect(page.getByTestId("app-main")).toBeVisible();
    await expect(page.getByTestId("meter")).toBeVisible();
  });
});
