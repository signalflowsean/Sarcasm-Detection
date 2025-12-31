import { expect, test } from "@playwright/test";

// Use a desktop viewport to test desktop text input behavior
// The app's tablet breakpoint is 1440px (TABLET_BREAKPOINT)
// Desktop is >= 1440px
test.use({ viewport: { width: 1500, height: 900 } });

test.describe("Text Input Mode (Desktop)", () => {
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

test.describe("Text Input Mode (Mobile/Tablet)", () => {
  // Use mobile viewport to test mobile text input behavior
  test.use({ viewport: { width: 768, height: 1024 } });

  test.beforeEach(async ({ page }) => {
    // On mobile, routing is disabled - go to root
    await page.goto("/");
  });

  test("should display text input area in lexical mode", async ({ page }) => {
    // Should be in lexical mode by default
    const mobileControls = page.getByTestId("mobile-input-controls");
    await expect(mobileControls).toHaveAttribute("data-mode", "lexical");

    // Textarea should be visible and editable
    const textarea = page.locator(".mobile-input-controls__textarea textarea");
    await expect(textarea).toBeVisible();
    await expect(textarea).toBeEnabled();
  });

  test("should allow typing text in lexical mode", async ({ page }) => {
    const textarea = page.locator(".mobile-input-controls__textarea textarea");

    await textarea.fill("This is a test message");

    await expect(textarea).toHaveValue("This is a test message");
  });

  test("should have submit functionality in lexical mode", async ({ page }) => {
    const textarea = page.locator(".mobile-input-controls__textarea textarea");

    // Type some text
    await textarea.fill("Oh wow, this is just amazing.");

    // The submit button should be visible when text is entered
    const sendButton = page.getByTestId("mobile-send-button");
    await expect(sendButton).toBeVisible();
    await expect(sendButton).toBeEnabled();
  });
});
