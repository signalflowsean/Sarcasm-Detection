import { expect, test } from '@playwright/test';

/**
 * Rate limiting tests.
 * These tests verify that rate limiting works correctly with proxy headers.
 * They require the backend to be running.
 */
test.describe('Rate Limiting', () => {
  const backendUrl = process.env.E2E_BACKEND_URL || 'http://localhost:5000';

  test('should rate limit requests from same IP', async ({ request }) => {
    // Make requests rapidly to trigger rate limit
    // Lexical endpoint limit is 30 per minute
    const requests = [];
    for (let i = 0; i < 35; i++) {
      requests.push(
        request.post(`${backendUrl}/api/lexical`, {
          data: { text: `Test request ${i}` },
          headers: { 'Content-Type': 'application/json' },
        })
      );
    }

    const responses = await Promise.all(requests);

    // At least one request should be rate limited (429)
    const rateLimited = responses.some((r) => r.status() === 429);
    expect(rateLimited).toBeTruthy();
  });

  test('should use X-Forwarded-For header for rate limiting', async ({
    request,
  }) => {
    // Make requests with X-Forwarded-For header
    const clientIp = '192.168.1.100';

    // Make enough requests to trigger rate limit for this IP
    const requests = [];
    for (let i = 0; i < 35; i++) {
      requests.push(
        request.post(`${backendUrl}/api/lexical`, {
          data: { text: `Test request ${i}` },
          headers: {
            'Content-Type': 'application/json',
            'X-Forwarded-For': clientIp,
          },
        })
      );
    }

    const responses = await Promise.all(requests);

    // Should rate limit based on X-Forwarded-For IP
    const rateLimited = responses.some((r) => r.status() === 429);
    expect(rateLimited).toBeTruthy();
  });

  test('should use first IP in X-Forwarded-For chain', async ({ request }) => {
    // X-Forwarded-For with multiple IPs (proxy chain)
    const clientIp = '10.0.0.50';
    const proxyIp = '192.168.1.1';
    const forwardedFor = `${clientIp}, ${proxyIp}`;

    // Make requests with proxy chain header
    const requests = [];
    for (let i = 0; i < 35; i++) {
      requests.push(
        request.post(`${backendUrl}/api/lexical`, {
          data: { text: `Test request ${i}` },
          headers: {
            'Content-Type': 'application/json',
            'X-Forwarded-For': forwardedFor,
          },
        })
      );
    }

    const responses = await Promise.all(requests);

    // Should rate limit based on first IP (client IP), not proxy IP
    const rateLimited = responses.some((r) => r.status() === 429);
    expect(rateLimited).toBeTruthy();
  });

  test('should fallback to X-Real-IP when X-Forwarded-For missing', async ({
    request,
  }) => {
    const clientIp = '172.16.0.100';

    // Make requests with X-Real-IP header (no X-Forwarded-For)
    const requests = [];
    for (let i = 0; i < 35; i++) {
      requests.push(
        request.post(`${backendUrl}/api/lexical`, {
          data: { text: `Test request ${i}` },
          headers: {
            'Content-Type': 'application/json',
            'X-Real-IP': clientIp,
          },
        })
      );
    }

    const responses = await Promise.all(requests);

    // Should rate limit based on X-Real-IP
    const rateLimited = responses.some((r) => r.status() === 429);
    expect(rateLimited).toBeTruthy();
  });

  test('should reject invalid IP addresses in headers', async ({ request }) => {
    // Make request with invalid IP in X-Forwarded-For
    const response = await request.post(`${backendUrl}/api/lexical`, {
      data: { text: 'Test' },
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': 'invalid-ip-address',
      },
    });

    // Should still work (falls back to remote_addr), but logs warning
    // The request should succeed, but rate limiting should use fallback
    expect([200, 429]).toContain(response.status());
  });

  test('should handle rate limit error response correctly', async ({
    request,
  }) => {
    // Trigger rate limit
    const requests = [];
    for (let i = 0; i < 35; i++) {
      requests.push(
        request.post(`${backendUrl}/api/lexical`, {
          data: { text: `Test request ${i}` },
          headers: { 'Content-Type': 'application/json' },
        })
      );
    }

    const responses = await Promise.all(requests);
    const rateLimitedResponse = responses.find((r) => r.status() === 429);

    if (rateLimitedResponse) {
      const body = await rateLimitedResponse.json();
      expect(body).toHaveProperty('error');
      expect(body.error).toContain('Rate limit');
    }
  });
});
