/**
 * Smoke Tests
 *
 * Quick sanity checks that verify external dependencies are available.
 * These run fast and catch configuration errors before longer tests run.
 */

import { expect, test } from "@playwright/test";

test.describe("Smoke Tests", () => {
  test("model configuration is valid", () => {
    // Validate that MOONSHINE_MODEL_NAME and VITE_MOONSHINE_MODEL are in sync
    // This is a critical configuration check that must pass
    const e2eModelName = process.env.MOONSHINE_MODEL_NAME || "tiny";

    // Mirror the exact logic from useSpeechRecognition.ts
    const envModel = process.env.VITE_MOONSHINE_MODEL;
    const effectiveModelPath =
      typeof envModel === "string" && envModel.trim() !== ""
        ? envModel.trim()
        : "model/tiny";

    // Extract model name from effective path (remove 'model/' prefix)
    const frontendModelName = effectiveModelPath.replace(/^model\//, "");

    // This should be an exact match - configuration must be correct
    expect(
      e2eModelName,
      `Model configuration mismatch:
  MOONSHINE_MODEL_NAME="${e2eModelName}" (e2e)
  VITE_MOONSHINE_MODEL="${
    process.env.VITE_MOONSHINE_MODEL || "undefined"
  }" → "${frontendModelName}" (effective)
  These must refer to the same model. See env.example files.`,
    ).toBe(frontendModelName);
  });

  test("Moonshine model URL is valid", async ({ request }) => {
    // Best-effort smoke test: Verify Moonshine model CDN is accessible.
    // This is NOT a guarantee the app works - just that models are downloadable.
    //
    // URL pattern is reverse-engineered from MoonshineJS behavior.
    // The app passes 'model/tiny' to MoonshineJS, which internally constructs URLs.
    //
    // If MoonshineJS changes URL structure, update this test AND frontend env.example.
    // Moonshine models typically include: encoder_model.onnx, decoder_model.onnx, tokenizer.json
    // We only check encoder_model.onnx as it's the largest/most critical file.
    //
    // Failure modes:
    // - MoonshineJS URL change: Update test pattern
    // - Model name change: Update MOONSHINE_MODEL_NAME in e2e/env.example
    // - Network outage: Models temporarily unavailable (false positive)
    const modelName = process.env.MOONSHINE_MODEL_NAME || "tiny";
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
