/**
 * Smoke Tests
 *
 * Quick sanity checks that verify external dependencies are available.
 * These run fast and catch configuration errors before longer tests run.
 */

import { expect, test } from "@playwright/test";

test.describe("Smoke Tests", () => {
  test("model configuration is valid", () => {
    // Validate VITE_MOONSHINE_MODEL format
    // This is a critical configuration check that must pass
    const envModel = process.env.VITE_MOONSHINE_MODEL;
    const effectiveModelPath =
      typeof envModel === "string" && envModel.trim() !== ""
        ? envModel.trim()
        : "model/base";

    // Validate format: must start with 'model/'
    expect(
      effectiveModelPath.startsWith("model/"),
      `Invalid VITE_MOONSHINE_MODEL format:
  Got: "${effectiveModelPath}"
  Expected format: "model/{name}" (e.g., model/base, model/tiny)

  See env.example files and frontend/docs/MOONSHINE_MODELS.md for configuration.`,
    ).toBe(true);

    // Extract model name for CDN validation
    const modelName = effectiveModelPath.replace(/^model\//, "");

    // Validate model name is one of the known models
    const validModels = ["tiny", "base"];
    expect(
      validModels.includes(modelName),
      `Unknown model name: "${modelName}"
  Valid models: ${validModels.join(", ")}
  VITE_MOONSHINE_MODEL="${effectiveModelPath}"

  See frontend/docs/MOONSHINE_MODELS.md for available models.`,
    ).toBe(true);
  });

  test("Moonshine configured model is available", async ({ request }) => {
    // Best-effort smoke test: Verify the configured Moonshine model CDN is accessible.
    // This is NOT a guarantee the app works - just that the model is downloadable.
    //
    // URL pattern is reverse-engineered from MoonshineJS behavior.
    // The app passes 'model/base' to MoonshineJS, which internally constructs URLs.
    //
    // If MoonshineJS changes URL structure, update this test AND frontend env.example.
    // Moonshine models typically include: encoder_model.onnx, decoder_model.onnx, tokenizer.json
    // We only check encoder_model.onnx as it's the largest/most critical file.
    //
    // Failure modes:
    // - MoonshineJS URL change: Update test pattern
    // - Model name change: Update VITE_MOONSHINE_MODEL in env.example files
    // - Network outage: Models temporarily unavailable (false positive)
    const envModel = process.env.VITE_MOONSHINE_MODEL;
    const effectiveModelPath =
      typeof envModel === "string" && envModel.trim() !== ""
        ? envModel.trim()
        : "model/base";

    // Extract model name (remove 'model/' prefix)
    const modelName = effectiveModelPath.replace(/^model\//, "");

    const modelBaseUrl = `https://download.moonshine.ai/model/${modelName}/quantized`;
    const encoderUrl = `${modelBaseUrl}/encoder_model.onnx`;

    // HEAD request to check if the file exists (doesn't download the full model)
    const response = await request.head(encoderUrl);

    expect(response.ok(), `Moonshine model not found at ${encoderUrl}`).toBe(
      true,
    );
  });

  test("All Moonshine models are available on CDN", async ({ request }) => {
    // Verify available models (tiny, base) are accessible on the CDN.
    // Note: "small" model was mentioned in early docs but doesn't exist on CDN.
    // This ensures users can switch models in dev mode without issues.
    const models = ["tiny", "base"];

    for (const modelName of models) {
      const modelBaseUrl = `https://download.moonshine.ai/model/${modelName}/quantized`;
      const encoderUrl = `${modelBaseUrl}/encoder_model.onnx`;

      const response = await request.head(encoderUrl);

      expect(
        response.ok(),
        `Model '${modelName}' not found at ${encoderUrl}. CDN may be down or model path has changed.`,
      ).toBe(true);
    }
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
