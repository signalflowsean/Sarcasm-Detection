import { test, expect } from "@playwright/test";

// Use a desktop viewport to avoid the mobile modal behavior
// The app's mobile breakpoint is 1440px
test.use({ viewport: { width: 1500, height: 900 } });

test.describe("Text Input Mode", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to text mode (correct path is /text-input)
    await page.goto("/text-input");
  });

  test("should display text input area", async ({ page }) => {
    // Should have a textarea for text input
    await expect(page.getByTestId("text-input")).toBeVisible();
    await expect(page.getByTestId("textarea")).toBeVisible();
  });

  test("should allow typing text", async ({ page }) => {
    const textarea = page.getByTestId("textarea");

    await textarea.fill("This is a test message");

    await expect(textarea).toHaveValue("This is a test message");
  });

  test("should have submit functionality", async ({ page }) => {
    const textarea = page.getByTestId("textarea");

    // Type some text
    await textarea.fill("Oh wow, this is just amazing.");

    // The submit button should be visible when text is entered
    await expect(page.getByTestId("text-send-button")).toBeVisible();
  });
});
