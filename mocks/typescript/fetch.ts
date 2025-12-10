/**
 * Shared fetch/API mocks for testing.
 */

import apiResponses from "../api/responses.json";

export type LexicalResponse = {
  id: string;
  value: number;
  reliable: boolean;
};

export type ProsodicResponse = {
  id: string;
  value: number;
  reliable: boolean;
};

export type HealthResponse = {
  status: string;
  lexical_model: boolean;
  prosodic_model: boolean;
  wav2vec2: boolean;
};

/**
 * Get mock API responses from the shared JSON fixtures.
 */
export const mockResponses = {
  lexical: apiResponses.lexical as Record<string, LexicalResponse>,
  prosodic: apiResponses.prosodic as Record<string, ProsodicResponse>,
  health: apiResponses.health as Record<string, HealthResponse>,
};

/**
 * Create a mock fetch Response object.
 */
export function createMockFetchResponse<T>(
  data: T,
  ok = true,
  status = 200,
): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    headers: new Headers(),
    redirected: false,
    statusText: ok ? "OK" : "Error",
    type: "basic",
    url: "",
    clone: function () {
      return this;
    },
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    bytes: () => Promise.resolve(new Uint8Array()),
  } as Response;
}

/**
 * Create a mock fetch that returns an error response.
 */
export function createMockFetchError(
  error: string,
  status = 400,
): Promise<Response> {
  return Promise.resolve(createMockFetchResponse({ error }, false, status));
}

/**
 * Create a mock fetch that returns a network error.
 */
export function createMockNetworkError(
  message = "Network error",
): Promise<never> {
  return Promise.reject(new Error(message));
}

/**
 * Create a mock fetch function that intercepts API calls.
 */
export function createMockFetch(config: {
  lexical?: LexicalResponse;
  prosodic?: ProsodicResponse;
  health?: HealthResponse;
  delay?: number;
  shouldFail?: boolean;
  errorMessage?: string;
}) {
  const {
    lexical = mockResponses.lexical.sarcastic,
    prosodic = mockResponses.prosodic.sarcastic,
    health = mockResponses.health.healthy,
    delay = 0,
    shouldFail = false,
    errorMessage = "Mock error",
  } = config;

  return async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString();

    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    if (shouldFail) {
      return createMockFetchResponse({ error: errorMessage }, false, 500);
    }

    if (url.includes("/api/lexical")) {
      return createMockFetchResponse(lexical);
    }

    if (url.includes("/api/prosodic")) {
      return createMockFetchResponse(prosodic);
    }

    if (url.includes("/api/health")) {
      return createMockFetchResponse(health);
    }

    // Pass through to real fetch for unhandled URLs
    return fetch(input, init);
  };
}
