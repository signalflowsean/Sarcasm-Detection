/**
 * Smoke Tests
 *
 * Quick sanity checks that verify external dependencies are available.
 * These run fast and catch configuration errors before longer tests run.
 */

import { expect, test } from "@playwright/test";

/**
 * Validate that MOONSHINE_MODEL_NAME and VITE_MOONSHINE_MODEL are in sync.
 * MOONSHINE_MODEL_NAME: "tiny" (no prefix)
 * VITE_MOONSHINE_MODEL: "model/tiny" (with prefix)
 */
function validateModelConfig(): string {
  const e2eModelName = process.env.MOONSHINE_MODEL_NAME || "tiny";
  const frontendModelPath = process.env.VITE_MOONSHINE_MODEL || "model/tiny";

  // Extract model name from frontend path (remove 'model/' prefix)
  const frontendModelName = frontendModelPath.replace(/^model\//, "");

  if (e2eModelName !== frontendModelName) {
    console.warn(
      `⚠️  Configuration mismatch detected:\n` +
        `   MOONSHINE_MODEL_NAME="${e2eModelName}" (e2e)\n` +
        `   VITE_MOONSHINE_MODEL="${frontendModelPath}" → "${frontendModelName}" (frontend)\n` +
        `   These should refer to the same model. See env.example files.`,
    );
  }

  return e2eModelName;
}

test.describe("Smoke Tests", () => {
  test("Moonshine model URL is valid", async ({ request }) => {
    // Verify that the Moonshine model CDN is accessible.
    // Note: This URL pattern is reverse-engineered from MoonshineJS behavior.
    // The app passes 'model/tiny' to MoonshineJS, which internally constructs the URL.
    // If MoonshineJS changes their URL structure, this test may need updating.
    const modelName = validateModelConfig();
    const modelBaseUrl = `https://download.moonshine.ai/model/${modelName}/quantized`;
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
