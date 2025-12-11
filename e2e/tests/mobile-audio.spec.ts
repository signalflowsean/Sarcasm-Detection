import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  injectAudioMocksWithMoonshine,
  loadTestAudioBase64,
  type MoonshineMockOptions,
  waitForAudioMocksReady,
} from "./utils/audio-mocks";

/**
 * Mobile Audio Recording E2E Tests
 *
 * These tests verify audio recording behavior on mobile devices.
 * Playwright provides real device emulation with proper touch events, viewport, and
 * user agent strings that trigger mobile code paths in the app.
 *
 * Note: Speech-to-text transcript content cannot be mocked in E2E tests because
 * ES module imports (MoonshineJS) can't be intercepted at runtime. The transcript
 * tests verify the UI elements exist and recording works, but not transcript content.
 * Transcript content is tested via unit tests where MoonshineJS can be properly mocked.
 */

/**
 * Inject audio mocks (MediaRecorder, AudioContext).
 * Note: MoonshineJS cannot be mocked at runtime in E2E tests.
 */
async function injectMobileMocks(
  page: Page,
  audioBase64: string,
  options: MoonshineMockOptions = {},
) {
  await injectAudioMocksWithMoonshine(page, audioBase64, options);
}

// Export helpers for use in other test files
export { injectMobileMocks, loadTestAudioBase64 };

// Use a small mobile viewport to trigger mobile UI
// The app's mobile breakpoint considers touch + viewport < 1024px
test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  permissions: ["microphone"],
  launchOptions: {
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
    ],
  },
});

test.describe("Mobile Audio Recording", () => {
  test.beforeEach(async ({ page }) => {
    const audioBase64 = loadTestAudioBase64();
    await injectMobileMocks(page, audioBase64);
  });

  test("should show mobile modal launcher on audio page", async ({ page }) => {
    await page.goto("/audio-input");

    // On mobile, should see the floating launcher button
    const launcher = page.locator(".audio-recorder__launcher");
    await expect(launcher).toBeVisible();
  });

  test("should open mobile modal when launcher tapped", async ({ page }) => {
    await page.goto("/audio-input");

    const launcher = page.locator(".audio-recorder__launcher");
    await expect(launcher).toBeVisible();

    // Tap the launcher
    await launcher.tap();

    // Modal should open
    await expect(page.locator(".audio-recorder__modal")).toBeVisible();

    // Mic button should be visible in modal
    await expect(page.getByTestId("mic-button")).toBeVisible();
  });

  test("should record audio in mobile modal", async ({ page }) => {
    await page.goto("/audio-input");
    await waitForAudioMocksReady(page);

    // Open modal
    const launcher = page.locator(".audio-recorder__launcher");
    await launcher.tap();

    const micButton = page.getByTestId("mic-button");
    await expect(micButton).toBeVisible();
    await expect(micButton).toBeEnabled();

    // Start recording (force: true bypasses animation stability check)
    await micButton.tap({ force: true });
    await expect(micButton).toHaveClass(/is-recording/, { timeout: 10000 });

    // Wait and stop
    await page.waitForTimeout(500);
    await micButton.tap({ force: true });
    await expect(micButton).not.toHaveClass(/is-recording/, { timeout: 10000 });

    // Should have send button
    await expect(page.getByTestId("send-button")).toBeVisible();
  });

  test("should have transcript area visible during recording", async ({
    page,
  }) => {
    await page.goto("/audio-input");
    await waitForAudioMocksReady(page);

    // Open modal
    await page.locator(".audio-recorder__launcher").tap();

    const micButton = page.getByTestId("mic-button");
    await expect(micButton).toBeEnabled();
    await micButton.tap({ force: true });
    await expect(micButton).toHaveClass(/is-recording/, { timeout: 10000 });

    // Transcript area should be visible and accessible
    const transcript = page.locator(".audio-recorder__transcript");
    await expect(transcript).toBeVisible();
    await expect(transcript).toHaveAttribute("aria-label", "Speech transcript");

    // Stop recording
    await micButton.tap({ force: true });
    await expect(micButton).not.toHaveClass(/is-recording/, { timeout: 10000 });

    // Send button should be available after recording
    await expect(page.getByTestId("send-button")).toBeVisible();
    await expect(page.getByTestId("send-button")).toBeEnabled();
  });
});

test.describe("Mobile Audio UI", () => {
  test.beforeEach(async ({ page }) => {
    const audioBase64 = loadTestAudioBase64();
    await injectMobileMocks(page, audioBase64);
  });

  test("should show correct placeholder in transcript area", async ({
    page,
  }) => {
    await page.goto("/audio-input");
    await waitForAudioMocksReady(page);

    // Open modal
    await page.locator(".audio-recorder__launcher").tap();

    const transcript = page.locator(".audio-recorder__transcript");
    await expect(transcript).toBeVisible();

    // Placeholder should show "Speak to transcribe..." or "Loading speech model..."
    const placeholder = await transcript.getAttribute("placeholder");
    expect(
      placeholder?.includes("Speak to transcribe") ||
        placeholder?.includes("Loading speech model"),
    ).toBe(true);
  });

  test("should complete full recording workflow on mobile", async ({
    page,
  }) => {
    await page.goto("/audio-input");
    await waitForAudioMocksReady(page);

    // Open modal
    await page.locator(".audio-recorder__launcher").tap();

    const micButton = page.getByTestId("mic-button");
    await expect(micButton).toBeEnabled();

    // Start recording
    await micButton.tap({ force: true });
    await expect(micButton).toHaveClass(/is-recording/, { timeout: 10000 });

    // Wait for some recording time
    await page.waitForTimeout(500);

    // Stop recording
    await micButton.tap({ force: true });
    await expect(micButton).not.toHaveClass(/is-recording/, { timeout: 10000 });

    // Verify all controls are available
    await expect(page.getByTestId("send-button")).toBeVisible();
    await expect(page.getByTestId("send-button")).toBeEnabled();
    await expect(page.getByTestId("discard-button")).toBeVisible();
    await expect(page.getByTestId("discard-button")).toBeEnabled();
    await expect(page.getByTestId("play-button")).toBeVisible();
  });
});
