import { expect, test } from "@playwright/test"

/**
 * Browser Support Modal E2E Tests
 *
 * Tests the browser compatibility warning modal that appears for:
 * - Chrome on Android: Speech-to-text not supported
 * - Firefox (all platforms): Degraded speech-to-text quality
 *
 * Uses Playwright user agent overrides to simulate different browser/device combinations.
 * Note: Device profiles with defaultBrowserType cannot be used inside describe blocks,
 * so we use userAgent + viewport overrides instead.
 */

// Chrome on Android user agent
const CHROME_ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36";

// Firefox desktop user agent
const FIREFOX_DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0";

// Firefox on Android user agent
const FIREFOX_ANDROID_UA =
  "Mozilla/5.0 (Android 13; Mobile; rv:121.0) Gecko/121.0 Firefox/121.0";

test.describe("Browser Support Modal - Chrome on Android", () => {
  test.use({
    userAgent: CHROME_ANDROID_UA,
    viewport: { width: 393, height: 851 },
    hasTouch: true,
    isMobile: true,
  });

  test("should show unsupported browser modal on Chrome for Android", async ({
    page,
  }) => {
    await page.goto("/");

    // Modal should be visible
    const modal = page.getByTestId("browser-support-modal");
    await expect(modal).toBeVisible();

    // Should show Chrome Android specific content
    await expect(page.locator(".browser-support-modal__title")).toContainText(
      "Wrong Browser"
    );
    await expect(page.locator(".browser-support-modal__body")).toContainText(
      "Chrome for Android"
    );
  });

  test("should close modal via close button", async ({ page }) => {
    await page.goto("/");

    const modal = page.getByTestId("browser-support-modal");
    await expect(modal).toBeVisible();

    // Click close button
    const closeButton = page.locator(".browser-support-modal__close");
    await closeButton.click();

    // Modal should be hidden
    await expect(modal).not.toBeVisible();
  });

  test("should close modal via CTA button", async ({ page }) => {
    await page.goto("/");

    const modal = page.getByTestId("browser-support-modal");
    await expect(modal).toBeVisible();

    // Click CTA button
    const ctaButton = page.locator(".browser-support-modal__cta");
    await ctaButton.click();

    // Modal should be hidden
    await expect(modal).not.toBeVisible();
  });

  test("should close modal via Escape key", async ({ page }) => {
    await page.goto("/");

    const modal = page.getByTestId("browser-support-modal");
    await expect(modal).toBeVisible();

    // Press Escape
    await page.keyboard.press("Escape");

    // Modal should be hidden
    await expect(modal).not.toBeVisible();
  });

  test("should close modal via backdrop click", async ({ page }) => {
    await page.goto("/");

    const modal = page.getByTestId("browser-support-modal");
    await expect(modal).toBeVisible();

    // Native <dialog> backdrop clicks are detected by clicking on the dialog
    // element in an area outside the content. We need to click on the dialog
    // padding area (between dialog edge and content).
    const dialog = page.locator(".browser-support-modal");
    const content = page.locator(".browser-support-modal__content");

    const dialogBox = await dialog.boundingBox();
    const contentBox = await content.boundingBox();

    if (dialogBox && contentBox) {
      // Click in the area between dialog edge and content (the backdrop area)
      // Click above the content
      const clickY = contentBox.y - 20;
      const clickX = dialogBox.x + dialogBox.width / 2;

      if (clickY > dialogBox.y) {
        await page.mouse.click(clickX, clickY);
        await expect(modal).not.toBeVisible();
      } else {
        // If there's no space above, skip this test
        test.skip();
      }
    }
  });
});

test.describe("Browser Support Modal - Firefox Desktop", () => {
  test.use({
    userAgent: FIREFOX_DESKTOP_UA,
  });

  test("should show degraded experience modal on Firefox", async ({ page }) => {
    await page.goto("/");

    // Modal should be visible
    const modal = page.getByTestId("browser-support-modal");
    await expect(modal).toBeVisible();

    // Should show Firefox specific content
    await expect(page.locator(".browser-support-modal__title")).toContainText(
      "Firefox"
    );
    await expect(page.locator(".browser-support-modal__body")).toContainText(
      "Chrome"
    );
  });

  test("should close Firefox modal via close button", async ({ page }) => {
    await page.goto("/");

    const modal = page.getByTestId("browser-support-modal");
    await expect(modal).toBeVisible();

    // Click close button
    const closeButton = page.locator(".browser-support-modal__close");
    await closeButton.click();

    // Modal should be hidden
    await expect(modal).not.toBeVisible();
  });

  test("should close Firefox modal via Escape key", async ({ page }) => {
    await page.goto("/");

    const modal = page.getByTestId("browser-support-modal");
    await expect(modal).toBeVisible();

    // Press Escape
    await page.keyboard.press("Escape");

    // Modal should be hidden
    await expect(modal).not.toBeVisible();
  });
});

test.describe("Browser Support Modal - Firefox on Android", () => {
  test.use({
    userAgent: FIREFOX_ANDROID_UA,
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test("should show Firefox modal (not Chrome Android) when on Firefox for Android", async ({
    page,
  }) => {
    await page.goto("/");

    // Modal should be visible
    const modal = page.getByTestId("browser-support-modal");
    await expect(modal).toBeVisible();

    // Should show Firefox message (Firefox takes priority over Android detection)
    await expect(page.locator(".browser-support-modal__title")).toContainText(
      "Firefox"
    );
  });
});

test.describe("Browser Support Modal - Supported Browsers", () => {
  test("should NOT show modal on Chrome Desktop", async ({ page }) => {
    // Default Playwright chromium should not trigger the modal
    await page.goto("/");

    // Modal should not be visible
    const modal = page.getByTestId("browser-support-modal");
    await expect(modal).not.toBeVisible();
  });
});

test.describe("Browser Support Modal - Accessibility", () => {
  test.use({
    userAgent: CHROME_ANDROID_UA,
    viewport: { width: 393, height: 851 },
    hasTouch: true,
    isMobile: true,
  });

  test("should have proper ARIA attributes", async ({ page }) => {
    await page.goto("/");

    const dialog = page.locator(".browser-support-modal");
    await expect(dialog).toBeVisible();

    // Check ARIA attributes
    await expect(dialog).toHaveAttribute(
      "aria-labelledby",
      "browser-support-title"
    );
    await expect(dialog).toHaveAttribute(
      "aria-describedby",
      "browser-support-body"
    );

    // Title and body should have matching IDs
    await expect(page.locator("#browser-support-title")).toBeVisible();
    await expect(page.locator("#browser-support-body")).toBeVisible();
  });

  test("should have accessible close button", async ({ page }) => {
    await page.goto("/");

    const closeButton = page.locator(".browser-support-modal__close");
    await expect(closeButton).toHaveAttribute("aria-label", "Close");
  });

  test("should keep focus within modal when tabbing", async ({ page }) => {
    await page.goto("/");

    const modal = page.getByTestId("browser-support-modal");
    await expect(modal).toBeVisible();

    const closeButton = page.locator(".browser-support-modal__close");
    const ctaButton = page.locator(".browser-support-modal__cta");

    // Focus the close button first
    await closeButton.focus();
    await expect(closeButton).toBeFocused();

    // Tab to CTA button
    await page.keyboard.press("Tab");
    await expect(ctaButton).toBeFocused();

    // Verify both interactive elements are within the modal
    await expect(closeButton).toBeVisible();
    await expect(ctaButton).toBeVisible();
  });
});
