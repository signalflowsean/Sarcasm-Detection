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

/**
 * Tests for detection value reset when switching modes.
 * Verifies that when a user sends a detection (text or audio+text) and then
 * switches modes, the sarcasm values (needle, lexical, prosodic) reset to 0.
 */

test.describe("Mode Switch Reset - Desktop", () => {
  // Use a desktop viewport
  test.use({ viewport: { width: 1500, height: 900 } });

  test("should reset values when switching from text to audio mode after detection", async ({
    page,
  }) => {
    // Mock API responses
    await page.route("**/api/lexical", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "test-lexical",
          value: 0.75,
          reliable: true,
        }),
      });
    });

    await page.route("**/api/prosodic", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "test-prosodic",
          value: 0.6,
          reliable: true,
        }),
      });
    });

    // Navigate to text mode
    await page.goto("/text-input");

    const textarea = page.getByTestId("textarea");
    const sendButton = page.getByTestId("text-send-button");

    // Send a detection in text mode
    await textarea.fill("Oh great, another meeting.");
    await sendButton.click();

    // Wait for detection to complete and show result
    await page.waitForTimeout(2000);

    // Verify needle has moved (not at zero)
    const needle = page.locator(".meter__needle");
    const initialRotation = await needle.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.getPropertyValue("--needle-rotation");
    });
    expect(initialRotation).not.toContain("-50deg"); // -50deg is zero position

    // Switch to audio mode using rotary switch
    // The rotary switch supports keyboard navigation (ArrowLeft/ArrowRight)
    const rotarySwitch = page.locator('[data-testid="rotary-switch"]');
    // Focus the switch and press ArrowRight to advance to next position (text -> audio)
    await rotarySwitch.focus();
    await page.keyboard.press("ArrowRight");

    // Wait for mode switch to complete
    await page.waitForTimeout(500);

    // Verify we're now in audio mode
    await page.waitForURL("/audio-input", { timeout: 5000 });

    // Verify needle has reset to zero
    const resetRotation = await needle.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.getPropertyValue("--needle-rotation");
    });
    expect(resetRotation).toContain("-50deg"); // Should be at zero position
  });

  test("should reset values when switching from audio to text mode after detection", async ({
    page,
  }) => {
    // Mock API responses
    await page.route("**/api/lexical", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "test-lexical",
          value: 0.8,
          reliable: true,
        }),
      });
    });

    await page.route("**/api/prosodic", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "test-prosodic",
          value: 0.7,
          reliable: true,
        }),
      });
    });

    // Inject audio mocks BEFORE navigation (addInitScript must be called before goto)
    const audioBase64 = loadTestAudioBase64();
    await injectAudioMocks(page, audioBase64);

    // Navigate to audio mode
    await page.goto("/audio-input");
    await waitForAudioMocksReady(page);

    const micButton = page.getByTestId("mic-button");
    const sendButton = page.getByTestId("send-button");

    // Record audio (start and stop) instead of typing text
    // The textarea is disabled in audio mode (read-only for transcription)
    await clickMicButton(page);
    await expect(micButton).toHaveClass(/is-recording/, { timeout: 5000 });

    await page.waitForTimeout(500);

    await clickMicButton(page);
    await expect(micButton).not.toHaveClass(/is-recording/, { timeout: 5000 });

    // Wait for send button to be available
    await expect(sendButton).toBeVisible({ timeout: 5000 });
    await sendButton.click();

    // Wait for detection to complete
    await page.waitForTimeout(2000);

    // Verify needle has moved
    const needle = page.locator(".meter__needle");
    const initialRotation = await needle.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.getPropertyValue("--needle-rotation");
    });
    expect(initialRotation).not.toContain("-50deg");

    // Switch to text mode using rotary switch
    const rotarySwitch = page.locator('[data-testid="rotary-switch"]');
    // Focus the switch and press ArrowLeft to go back to text mode (audio -> text)
    await rotarySwitch.focus();
    await page.keyboard.press("ArrowLeft");

    // Wait for mode switch
    await page.waitForTimeout(500);

    // Verify we're now in text mode
    await page.waitForURL("/text-input", { timeout: 5000 });

    // Wait for textarea to become enabled (it's disabled in audio mode)
    const textModeTextarea = page.getByTestId("textarea");
    await expect(textModeTextarea).toBeEnabled({ timeout: 5000 });

    // Verify needle has reset to zero
    const resetRotation = await needle.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.getPropertyValue("--needle-rotation");
    });
    expect(resetRotation).toContain("-50deg");
  });
});

test.describe("Mode Switch Reset - Mobile/Tablet", () => {
  // Use mobile viewport
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test("should reset values when switching from lexical to prosodic mode after detection", async ({
    page,
  }) => {
    // Mock API responses
    await page.route("**/api/lexical", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "test-lexical",
          value: 0.75,
          reliable: true,
        }),
      });
    });

    await page.route("**/api/prosodic", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "test-prosodic",
          value: 0.65,
          reliable: true,
        }),
      });
    });

    await page.goto("/");

    // Should be in lexical mode by default
    const mobileControls = page.getByTestId("mobile-input-controls");
    await expect(mobileControls).toHaveAttribute("data-mode", "lexical");

    const textarea = page.locator(".mobile-input-controls__textarea textarea");
    const sendButton = page.getByTestId("mobile-send-button");

    // Send a detection in lexical mode
    await textarea.fill("Oh great, another meeting.");
    await sendButton.click();

    // Wait for detection to complete
    await page.waitForTimeout(2000);

    // Verify needle has moved
    const needle = page.locator(".meter__needle");
    const initialRotation = await needle.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.getPropertyValue("--needle-rotation");
    });
    expect(initialRotation).not.toContain("-50deg");

    // Switch to prosodic mode using detection mode switch
    const modeSwitch = page.getByTestId("detection-mode-switch");
    await modeSwitch.click();

    // Wait for mode switch to complete
    await page.waitForTimeout(500);

    // Verify we're now in prosodic mode
    await expect(mobileControls).toHaveAttribute("data-mode", "prosodic");

    // Verify needle has reset to zero
    const resetRotation = await needle.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.getPropertyValue("--needle-rotation");
    });
    expect(resetRotation).toContain("-50deg");
  });

  test("should reset values when switching from prosodic to lexical mode after detection", async ({
    page,
  }) => {
    // Mock API responses
    await page.route("**/api/lexical", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "test-lexical",
          value: 0.7,
          reliable: true,
        }),
      });
    });

    await page.route("**/api/prosodic", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "test-prosodic",
          value: 0.6,
          reliable: true,
        }),
      });
    });

    // Inject audio mocks BEFORE navigation (addInitScript must be called before goto)
    const audioBase64 = loadTestAudioBase64();
    await injectAudioMocks(page, audioBase64);

    await page.goto("/");
    await waitForAudioMocksReady(page);

    // Switch to prosodic mode first
    const modeSwitch = page.getByTestId("detection-mode-switch");
    await modeSwitch.click();

    const mobileControls = page.getByTestId("mobile-input-controls");
    await expect(mobileControls).toHaveAttribute("data-mode", "prosodic");

    const micButton = page.getByTestId("mic-button");
    const sendButton = page.getByTestId("mobile-send-button");

    // Record audio (start and stop) instead of typing text
    // The textarea is disabled in prosodic mode (read-only for transcription)
    await micButton.tap({ force: true });
    await expect(micButton).toHaveClass(/is-recording/, { timeout: 10000 });

    await page.waitForTimeout(500);

    await micButton.tap({ force: true });
    await expect(micButton).not.toHaveClass(/is-recording/, { timeout: 10000 });

    // Wait for send button to be available
    await expect(sendButton).toBeVisible({ timeout: 5000 });
    await sendButton.click();

    // Wait for detection to complete
    await page.waitForTimeout(2000);

    // Verify needle has moved
    const needle = page.locator(".meter__needle");
    const initialRotation = await needle.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.getPropertyValue("--needle-rotation");
    });
    expect(initialRotation).not.toContain("-50deg");

    // Switch back to lexical mode
    await modeSwitch.click();

    // Wait for mode switch
    await page.waitForTimeout(500);

    // Verify we're back in lexical mode
    await expect(mobileControls).toHaveAttribute("data-mode", "lexical");

    // Wait for textarea to become enabled (it's disabled in prosodic mode)
    const lexicalTextarea = page.locator(
      ".mobile-input-controls__textarea textarea",
    );
    await expect(lexicalTextarea).toBeEnabled({ timeout: 5000 });

    // Verify needle has reset to zero
    const resetRotation = await needle.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.getPropertyValue("--needle-rotation");
    });
    expect(resetRotation).toContain("-50deg");
  });
});
