import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import {
  injectAudioMocksWithMoonshine,
  loadTestAudioBase64,
  waitForAudioMocksReady,
  type MoonshineMockOptions,
} from './utils/audio-mocks';

/**
 * Mobile Audio Recording E2E Tests
 *
 * These tests verify audio recording behavior on mobile devices.
 * Playwright provides real device emulation with proper touch events, viewport, and
 * user agent strings that trigger mobile code paths in the app.
 *
 * Note: On mobile/tablet, routing is disabled and all controls are visible on one page.
 * The detection mode switch allows switching between lexical (text) and prosodic (audio) modes.
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
  options: MoonshineMockOptions = {}
) {
  await injectAudioMocksWithMoonshine(page, audioBase64, options);
}

// Export helpers for use in other test files
export { injectMobileMocks, loadTestAudioBase64 };

// Use a small mobile viewport to trigger mobile UI
// The app's mobile breakpoint is 768px (MOBILE_BREAKPOINT)
test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  permissions: ['microphone'],
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
    ],
  },
});

test.describe('Mobile Audio Recording', () => {
  test.beforeEach(async ({ page }) => {
    const audioBase64 = loadTestAudioBase64();
    await injectMobileMocks(page, audioBase64);
  });

  test('should show mobile input controls on root page', async ({ page }) => {
    await page.goto('/');

    // On mobile, routing is disabled - everything is on one page
    await expect(page).toHaveURL('/');

    // Mobile input controls should be visible (not in a modal)
    const mobileControls = page.getByTestId('mobile-input-controls');
    await expect(mobileControls).toBeVisible();

    // Detection mode switch should be visible
    const modeSwitch = page.getByTestId('detection-mode-switch');
    await expect(modeSwitch).toBeVisible();
  });

  test('should switch to prosodic (audio) mode', async ({ page }) => {
    await page.goto('/');
    await waitForAudioMocksReady(page);

    const modeSwitch = page.getByTestId('detection-mode-switch');
    await expect(modeSwitch).toBeVisible();

    // By default, should be in lexical (text) mode
    // Click the switch to toggle to prosodic (audio) mode
    // The switch toggles between left (lexical) and right (prosodic)
    await modeSwitch.click();

    // Mic button should now be enabled (not disabled by lexical mode)
    const micButton = page.getByTestId('mic-button');
    await expect(micButton).toBeVisible();
    await expect(micButton).toBeEnabled();
  });

  test('should record audio in prosodic mode', async ({ page }) => {
    await page.goto('/');
    await waitForAudioMocksReady(page);

    // Switch to prosodic mode
    const modeSwitch = page.getByTestId('detection-mode-switch');
    await modeSwitch.click();

    const micButton = page.getByTestId('mic-button');
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
    await expect(page.getByTestId('mobile-send-button')).toBeVisible();
  });

  test('should have transcript area visible during recording', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForAudioMocksReady(page);

    // Switch to prosodic mode
    const modeSwitch = page.getByTestId('detection-mode-switch');
    await modeSwitch.click();

    const micButton = page.getByTestId('mic-button');
    await expect(micButton).toBeEnabled();
    await micButton.tap({ force: true });
    await expect(micButton).toHaveClass(/is-recording/, { timeout: 10000 });

    // Transcript area should be visible (readonly in prosodic mode)
    const textarea = page.locator('.mobile-input-controls__textarea textarea');
    await expect(textarea).toBeVisible();
    await expect(textarea).toBeDisabled(); // Readonly in prosodic mode

    // Stop recording
    await micButton.tap({ force: true });
    await expect(micButton).not.toHaveClass(/is-recording/, { timeout: 10000 });

    // Send button should be available after recording
    await expect(page.getByTestId('mobile-send-button')).toBeVisible();
    await expect(page.getByTestId('mobile-send-button')).toBeEnabled();
  });
});

test.describe('Mobile Audio UI', () => {
  test.beforeEach(async ({ page }) => {
    const audioBase64 = loadTestAudioBase64();
    await injectMobileMocks(page, audioBase64);
  });

  test('should show correct placeholder in transcript area for prosodic mode', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForAudioMocksReady(page);

    // Switch to prosodic mode
    const modeSwitch = page.getByTestId('detection-mode-switch');
    await modeSwitch.click();

    const textarea = page.locator('.mobile-input-controls__textarea textarea');
    await expect(textarea).toBeVisible();

    // Placeholder should show "Transcription will appear here..." or "Loading speech model..."
    const placeholder = await textarea.getAttribute('placeholder');
    expect(
      placeholder?.includes('Transcription will appear here') ||
        placeholder?.includes('Loading speech model')
    ).toBe(true);
  });

  test('should complete full recording workflow on mobile', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForAudioMocksReady(page);

    // Switch to prosodic mode
    const modeSwitch = page.getByTestId('detection-mode-switch');
    await modeSwitch.click();

    const micButton = page.getByTestId('mic-button');
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
    await expect(page.getByTestId('mobile-send-button')).toBeVisible();
    await expect(page.getByTestId('mobile-send-button')).toBeEnabled();
    await expect(page.getByTestId('mobile-trash-button')).toBeVisible();
    await expect(page.getByTestId('mobile-trash-button')).toBeEnabled();
    await expect(page.getByTestId('mobile-play-button')).toBeVisible();
  });

  test('should disable audio controls in lexical mode', async ({ page }) => {
    await page.goto('/');

    // Should be in lexical mode by default
    const mobileControls = page.getByTestId('mobile-input-controls');
    await expect(mobileControls).toHaveAttribute('data-mode', 'lexical');

    // Audio controls should be visible but disabled
    const micButton = page.getByTestId('mic-button');
    await expect(micButton).toBeVisible();
    await expect(micButton).toBeDisabled();

    const playButton = page.getByTestId('mobile-play-button');
    await expect(playButton).toBeVisible();
    await expect(playButton).toBeDisabled();

    const discardButton = page.getByTestId('mobile-trash-button');
    await expect(discardButton).toBeVisible();
    await expect(discardButton).toBeDisabled();
  });

  test('should show info button on mobile', async ({ page }) => {
    await page.goto('/');

    // Info button should be visible on mobile/tablet
    const infoButton = page.locator('.meter__info-button');
    await expect(infoButton).toBeVisible();
    await expect(infoButton).toHaveAttribute(
      'aria-label',
      'Open getting started guide'
    );
  });

  test('should open getting started modal when info button clicked', async ({
    page,
  }) => {
    await page.goto('/');

    const infoButton = page.locator('.meter__info-button');
    await infoButton.click();

    // Modal should open with getting started content
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    await expect(page.getByTestId('getting-started')).toBeVisible();
  });
});
