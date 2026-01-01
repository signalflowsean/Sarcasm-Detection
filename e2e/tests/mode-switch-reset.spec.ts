import { expect, test } from "@playwright/test";

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

    // Navigate to audio mode
    await page.goto("/audio-input");

    // Inject audio mocks for recording
    const audioBase64 =
      "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
    await page.addInitScript((base64) => {
      // Mock MediaRecorder
      (window as any).MediaRecorder = class {
        constructor() {}
        start() {}
        stop() {}
        ondataavailable = null;
        onstop = null;
        state = "inactive";
      };

      // Mock getUserMedia
      navigator.mediaDevices.getUserMedia = async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 100;
        canvas.height = 100;
        const stream = canvas.captureStream();
        return stream;
      };

      // Mock AudioContext
      (window as any).AudioContext = class {
        createMediaStreamSource() {
          return {
            connect: () => {},
            disconnect: () => {},
          };
        }
        createAnalyser() {
          return {
            getByteFrequencyData: () => {},
          };
        }
        close() {}
      };
    }, audioBase64);

    // Wait for audio mocks to be ready
    await page.waitForTimeout(500);

    const textarea = page.getByTestId("textarea");
    const sendButton = page.getByTestId("audio-send-button");

    // Type text and send (prosodic mode uses both audio and text)
    await textarea.fill("This is a test message");
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

    // Inject audio mocks
    const audioBase64 =
      "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
    await page.addInitScript((base64) => {
      (window as any).MediaRecorder = class {
        constructor() {}
        start() {}
        stop() {}
        ondataavailable = null;
        onstop = null;
        state = "inactive";
      };

      navigator.mediaDevices.getUserMedia = async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 100;
        canvas.height = 100;
        return canvas.captureStream();
      };

      (window as any).AudioContext = class {
        createMediaStreamSource() {
          return {
            connect: () => {},
            disconnect: () => {},
          };
        }
        createAnalyser() {
          return {
            getByteFrequencyData: () => {},
          };
        }
        close() {}
      };
    }, audioBase64);

    await page.goto("/");
    await page.waitForTimeout(500);

    // Switch to prosodic mode first
    const modeSwitch = page.getByTestId("detection-mode-switch");
    await modeSwitch.click();

    const mobileControls = page.getByTestId("mobile-input-controls");
    await expect(mobileControls).toHaveAttribute("data-mode", "prosodic");

    const textarea = page.locator(".mobile-input-controls__textarea textarea");
    const sendButton = page.getByTestId("mobile-send-button");

    // Type text and send (prosodic mode uses both audio and text)
    await textarea.fill("This is a test message");
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

    // Verify needle has reset to zero
    const resetRotation = await needle.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.getPropertyValue("--needle-rotation");
    });
    expect(resetRotation).toContain("-50deg");
  });
});
