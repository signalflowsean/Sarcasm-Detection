import { test, expect } from "@playwright/test";

/**
 * API health check tests.
 * These tests verify the backend API is accessible.
 * They require the backend to be running.
 */
test.describe("API Health", () => {
  // Skip these tests if no backend URL is provided
  const backendUrl = process.env.E2E_BACKEND_URL || "http://localhost:5000";

  test("should return healthy status from health endpoint", async ({
    request,
  }) => {
    const response = await request.get(`${backendUrl}/api/health`);

    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.status).toBe("healthy");
    expect(body).toHaveProperty("version");
    expect(body).toHaveProperty("models");
  });

  test("should return version info from version endpoint", async ({
    request,
  }) => {
    const response = await request.get(`${backendUrl}/api/version`);

    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty("version");
    expect(body).toHaveProperty("buildTime");
    expect(body).toHaveProperty("environment");
  });
});
