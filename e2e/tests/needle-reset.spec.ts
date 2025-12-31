import { expect, test } from "@playwright/test";

/**
 * Tests for needle reset behavior when rapid successive detections occur.
 * Verifies that the needle resets to zero before showing new values when
 * a new detection interrupts a previous one.
 */

// Use a desktop viewport
test.use({ viewport: { width: 1500, height: 900 } });

test.describe("Needle Reset on Rapid Detections", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/text-input");
  });

  test("should reset needle to zero before showing new value when interrupting (text mode)", async ({
    page,
  }) => {
    // Mock API responses with specific sarcasm values
    let requestCount = 0;
    await page.route("**/api/lexical", async (route) => {
      requestCount++;
      // First request returns high sarcasm (0.8)
      // Second request returns low sarcasm (0.2)
      const value = requestCount === 1 ? 0.8 : 0.2;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: `test-${requestCount}`,
          value: value,
          reliable: true,
        }),
      });
    });

    // Set up monitoring to capture needle rotation values
    await page.evaluate(() => {
      const needle = document.querySelector(".meter__needle");
      if (!needle) throw new Error("Needle not found");

      (window as any).__needleRotations = [];

      const observer = new MutationObserver(() => {
        const style = window.getComputedStyle(needle);
        const rotation = style.getPropertyValue("--needle-rotation");
        (window as any).__needleRotations.push(rotation);
      });

      observer.observe(needle, {
        attributes: true,
        attributeFilter: ["style"],
      });

      // Also poll to catch changes
      (window as any).__monitorInterval = setInterval(() => {
        const style = window.getComputedStyle(needle);
        const rotation = style.getPropertyValue("--needle-rotation");
        const rotations = (window as any).__needleRotations || [];
        if (
          rotations.length === 0 ||
          rotations[rotations.length - 1] !== rotation
        ) {
          rotations.push(rotation);
        }
      }, 50);
    });

    const textarea = page.getByTestId("textarea");
    const sendButton = page.getByTestId("text-send-button");

    // Send first detection
    await textarea.fill("Oh great, another meeting.");
    await sendButton.click();

    // Wait for first detection to complete and show result
    await page.waitForTimeout(1500);

    // Clear the recorded rotations and send second detection (interrupting)
    await page.evaluate(() => {
      (window as any).__needleRotations = [];
    });

    await textarea.fill("Thank you for your help.");
    await sendButton.click();

    // Wait for second detection cycle to complete
    await page.waitForTimeout(2000);

    // Clean up monitoring
    await page.evaluate(() => {
      clearInterval((window as any).__monitorInterval);
    });

    // Get the recorded rotations
    const rotations = await page.evaluate(() => {
      return (window as any).__needleRotations || [];
    });

    // Verify the sequence includes a reset to zero (-50deg)
    // The needle should go through zero when interrupted
    const hasResetToZero = rotations.some((rotation: string) =>
      rotation.includes("-50deg"),
    );

    expect(hasResetToZero).toBe(true);

    // Verify both requests were made
    expect(requestCount).toBe(2);
  });

  test("should handle multiple rapid detections correctly", async ({
    page,
  }) => {
    // Mock API with varying values
    let requestCount = 0;
    await page.route("**/api/lexical", async (route) => {
      requestCount++;
      const values = [0.9, 0.1, 0.5]; // High, low, medium
      const value = values[requestCount - 1] || 0.5;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: `test-${requestCount}`,
          value: value,
          reliable: true,
        }),
      });
    });

    const textarea = page.getByTestId("textarea");
    const sendButton = page.getByTestId("text-send-button");

    // Send three detections in rapid succession
    await textarea.fill("First sarcastic message");
    await sendButton.click();
    await page.waitForTimeout(1500);

    await textarea.fill("Second sincere message");
    await sendButton.click();
    await page.waitForTimeout(1500);

    await textarea.fill("Third neutral message");
    await sendButton.click();

    // Wait for all to complete
    await page.waitForTimeout(2000);

    // Verify all three requests were made
    expect(requestCount).toBe(3);

    // Verify the UI is back to idle state
    await expect(sendButton).toBeDisabled();
    await expect(sendButton).toHaveText(/Type Text First/);
  });
});
