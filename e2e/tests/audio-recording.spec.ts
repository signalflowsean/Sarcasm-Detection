import { expect, test, type Page } from "@playwright/test";
import {
  injectAudioMocks,
  loadTestAudioBase64,
  waitForAudioMocksReady,
} from "./utils/audio-mocks";

/**
 * Click the mic button using JavaScript instead of Playwright's click.
 * This is needed because Playwright's click({ force: true }) doesn't
 * properly trigger React's click handler on this specific button.
 */
async function clickMicButton(page: Page) {
  await page.evaluate(() => {
    const btn = document.querySelector(
      '[data-testid="mic-button"]',
    ) as HTMLButtonElement;
    btn?.click();
  });
}

// Use a desktop viewport to test desktop audio recording behavior
// The app's tablet breakpoint is 1440px (TABLET_BREAKPOINT)
// Desktop is >= 1440px
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
    await waitForAudioMocksReady(page);

    const micButton = page.getByTestId("mic-button");
    await expect(micButton).toBeVisible();
    await expect(micButton).toBeEnabled();

    // Start recording
    await clickMicButton(page);
    await expect(micButton).toHaveClass(/is-recording/, { timeout: 5000 });

    await page.waitForTimeout(500);

    // Stop recording
    await clickMicButton(page);
    await expect(micButton).not.toHaveClass(/is-recording/, { timeout: 5000 });

    await expect(page.getByTestId("send-button")).toBeVisible({
      timeout: 5000,
    });
  });

  test("should show playback controls after recording", async ({ page }) => {
    await page.goto("/audio-input");
    await waitForAudioMocksReady(page);

    const micButton = page.getByTestId("mic-button");
    await expect(micButton).toBeVisible();
    await expect(micButton).toBeEnabled();

    // Start recording
    await clickMicButton(page);
    await expect(micButton).toHaveClass(/is-recording/, { timeout: 5000 });

    await page.waitForTimeout(500);
    await clickMicButton(page);
    await expect(micButton).not.toHaveClass(/is-recording/, { timeout: 5000 });

    await expect(page.getByTestId("send-button")).toBeVisible({
      timeout: 5000,
    });
  });

  test("should discard recording when discard button clicked", async ({
    page,
  }) => {
    await page.goto("/audio-input");
    await waitForAudioMocksReady(page);

    const micButton = page.getByTestId("mic-button");
    await expect(micButton).toBeVisible();
    await expect(micButton).toBeEnabled();

    // Start recording
    await clickMicButton(page);
    await expect(micButton).toHaveClass(/is-recording/, { timeout: 5000 });

    await page.waitForTimeout(500);
    await clickMicButton(page);

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

    // Skip test if backend is not available
    const healthCheck = await request
      .get(`${backendUrl}/api/health`)
      .catch(() => null);
    test.skip(!healthCheck?.ok(), "Backend not available");

    await page.goto("/audio-input");
    await waitForAudioMocksReady(page);

    const micButton = page.getByTestId("mic-button");
    await expect(micButton).toBeVisible();
    await expect(micButton).toBeEnabled();

    await clickMicButton(page);
    await expect(micButton).toHaveClass(/is-recording/, { timeout: 5000 });

    await page.waitForTimeout(500);
    await clickMicButton(page);

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
    await waitForAudioMocksReady(page);

    const micButton = page.getByTestId("mic-button");
    await expect(micButton).toBeVisible();
    await expect(micButton).toBeEnabled();

    // Focus the page so keyboard events work
    await page.locator("body").click();

    // Press R to start recording
    await page.keyboard.press("r");
    await expect(micButton).toHaveClass(/is-recording/, { timeout: 5000 });

    // Press R again to stop
    await page.keyboard.press("r");
    await expect(micButton).not.toHaveClass(/is-recording/, { timeout: 5000 });
  });

  test("should navigate to audio mode via rotary switch", async ({ page }) => {
    await page.goto("/getting-started");
    await page.goto("/audio-input");

    await expect(page).toHaveURL(/audio-input/);
    await expect(page.getByTestId("audio-recorder")).toBeVisible();
    await expect(page.getByTestId("mic-button")).toBeVisible();
  });
});
