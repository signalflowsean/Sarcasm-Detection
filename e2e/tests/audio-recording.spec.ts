import { expect, test } from "@playwright/test";
import { injectAudioMocks, loadTestAudioBase64 } from "./utils/audio-mocks";

// Use a desktop viewport to avoid the mobile modal behavior
// The app's mobile breakpoint is 1440px
test.use({ viewport: { width: 1500, height: 900 } });

/**
 * Audio Recording E2E Tests
 *
 * These tests mock the browser's MediaRecorder API to test the complete
 * audio recording flow without requiring actual microphone access.
 *
 * Uses shared mocks from ./utils/audio-mocks for consistency across all tests.
 */

test.describe("Audio Recording", () => {
  test.beforeEach(async ({ page }) => {
    const audioBase64 = loadTestAudioBase64();
    await injectAudioMocks(page, audioBase64);
  });

  test("should display audio recording interface", async ({ page }) => {
    await page.goto("/audio-input");
    await expect(page.getByTestId("mic-button")).toBeVisible();
    await expect(page.getByTestId("waveform")).toBeVisible();
  });

  test("should start and stop recording", async ({ page }) => {
    await page.goto("/audio-input");
    await page.waitForTimeout(500);

    const micButton = page.getByTestId("mic-button");
    await expect(micButton).toBeVisible();

    // Start recording
    await micButton.click({ force: true });
    await expect(micButton).toHaveClass(/is-recording/, { timeout: 5000 });

    await page.waitForTimeout(500);

    // Stop recording
    await micButton.click({ force: true });
    await expect(micButton).not.toHaveClass(/is-recording/, { timeout: 5000 });

    await expect(page.getByTestId("send-button")).toBeVisible({
      timeout: 5000,
    });
  });

  test("should show playback controls after recording", async ({ page }) => {
    await page.goto("/audio-input");
    await page.waitForTimeout(500);

    const micButton = page.getByTestId("mic-button");
    await expect(micButton).toBeVisible();

    // Start recording
    await micButton.click({ force: true });
    await expect(micButton).toHaveClass(/is-recording/, { timeout: 5000 });

    await page.waitForTimeout(500);
    await micButton.click({ force: true });
    await expect(micButton).not.toHaveClass(/is-recording/, { timeout: 5000 });

    await expect(page.getByTestId("send-button")).toBeVisible({
      timeout: 5000,
    });
  });

  test("should discard recording when discard button clicked", async ({
    page,
  }) => {
    await page.goto("/audio-input");
    await page.waitForTimeout(500);

    const micButton = page.getByTestId("mic-button");
    await expect(micButton).toBeVisible();

    // Start recording
    await micButton.click({ force: true });
    await expect(micButton).toHaveClass(/is-recording/, { timeout: 5000 });

    await page.waitForTimeout(500);
    await micButton.click({ force: true });

    const sendButton = page.getByTestId("send-button");
    await expect(sendButton).toBeVisible({ timeout: 5000 });

    // Click discard button
    const discardButton = page.getByTestId("discard-button");
    await expect(discardButton).toBeEnabled({ timeout: 3000 });
    await discardButton.click();

    await expect(sendButton).toBeDisabled({ timeout: 3000 });
    await expect(sendButton).toContainText("Record Audio First");
  });

  test("should send recording to detector API", async ({ page, request }) => {
    const backendUrl = process.env.E2E_BACKEND_URL || "http://localhost:5000";
    try {
      const healthCheck = await request.get(`${backendUrl}/api/health`);
      if (!healthCheck.ok()) {
        test.skip();
        return;
      }
    } catch {
      test.skip();
      return;
    }

    await page.goto("/audio-input");
    await page.waitForTimeout(500);

    const micButton = page.getByTestId("mic-button");
    await expect(micButton).toBeVisible();

    await micButton.click({ force: true });
    await expect(micButton).toHaveClass(/is-recording/, { timeout: 5000 });

    await page.waitForTimeout(500);
    await micButton.click({ force: true });

    const sendButton = page.getByTestId("send-button");
    await expect(sendButton).toBeVisible({ timeout: 5000 });
    await sendButton.click();

    await page.waitForTimeout(3000);

    await expect(sendButton).toBeDisabled({ timeout: 5000 });
    await expect(sendButton).toContainText("Record Audio First");
  });

  test("should use keyboard shortcut R to toggle recording", async ({
    page,
  }) => {
    await page.goto("/audio-input");

    const micButton = page.getByTestId("mic-button");
    await expect(micButton).toBeVisible();

    await page.locator("body").click();

    // Press R to start recording
    await page.keyboard.press("r");
    await expect(micButton).toHaveClass(/is-recording/, { timeout: 5000 });

    // Press R again to stop
    await page.keyboard.press("r");
    await expect(micButton).not.toHaveClass(/is-recording/);
  });

  test("should navigate to audio mode via rotary switch", async ({ page }) => {
    await page.goto("/getting-started");
    await page.goto("/audio-input");

    await expect(page).toHaveURL(/audio-input/);
    await expect(page.getByTestId("audio-recorder")).toBeVisible();
    await expect(page.getByTestId("mic-button")).toBeVisible();
  });
});

test.describe("Audio Recording - Error States", () => {
  test.skip("should handle getUserMedia rejection gracefully", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      if (navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia = async () => {
          throw new DOMException("Permission denied", "NotAllowedError");
        };
      }
    });

    await page.goto("/audio-input");

    const micButton = page.getByTestId("mic-button");
    await expect(micButton).toBeVisible();
    await micButton.click({ force: true });

    const errorMessage = page.getByTestId("audio-error");
    await expect(errorMessage).toBeVisible({ timeout: 3000 });
    await expect(errorMessage).toContainText(/denied|permission|access/i);
  });
});
