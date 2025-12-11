/**
 * Smoke Tests
 *
 * Quick sanity checks that verify external dependencies are available.
 * These run fast and catch configuration errors before longer tests run.
 */

import { expect, test } from "@playwright/test";

test.describe("Smoke Tests", () => {
  test("Moonshine model URL is valid", async ({ request }) => {
    // This is the URL constructed by MoonshineJS for the tiny model
    // If this fails, speech-to-text won't work at all
    const modelBaseUrl = "https://download.moonshine.ai/model/tiny/quantized";
    const encoderUrl = `${modelBaseUrl}/encoder_model.onnx`;

    // HEAD request to check if the file exists (doesn't download the full 190MB)
    const response = await request.head(encoderUrl);

    expect(response.ok(), `Moonshine model not found at ${encoderUrl}`).toBe(
      true,
    );
  });

  test("Frontend is accessible", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.ok()).toBe(true);
  });

  test("Backend health check", async ({ request }) => {
    const backendUrl = process.env.E2E_BACKEND_URL || "http://localhost:5000";

    // Skip if backend is not available (common in frontend-only dev)
    const response = await request
      .get(`${backendUrl}/api/health`)
      .catch(() => null);

    test.skip(!response, "Backend not running");
    expect(response?.ok()).toBe(true);
  });
});
