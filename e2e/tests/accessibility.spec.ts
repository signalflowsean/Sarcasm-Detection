import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Use a desktop viewport to ensure consistent behavior
test.use({ viewport: { width: 1500, height: 900 } });

test.describe("Accessibility", () => {
  test("homepage should have no accessibility violations", async ({ page }) => {
    await page.goto("/");

    // Wait for app to fully load
    await expect(page.getByTestId("meter")).toBeVisible();

    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("text input mode should have no accessibility violations", async ({
    page,
  }) => {
    await page.goto("/text-input");

    // Wait for text input to be visible
    await expect(page.getByTestId("text-input")).toBeVisible();

    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("audio recording mode should have no accessibility violations", async ({
    page,
  }) => {
    await page.goto("/audio-input");

    // Wait for audio recorder to be visible
    await expect(page.getByTestId("audio-recorder")).toBeVisible();

    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("getting started page should have no accessibility violations", async ({
    page,
  }) => {
    await page.goto("/getting-started");

    // Wait for getting started content or meter (getting-started redirects)
    await expect(page.getByTestId("meter")).toBeVisible();

    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  // WCAG 2.0 Level A & AA compliance check
  test("should meet WCAG 2.0 AA standards", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("meter")).toBeVisible();

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
