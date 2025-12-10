/**
 * Shared mocks for TypeScript environments.
 *
 * Browser-compatible exports (work everywhere):
 *   import { createWavBlob, mockResponses, createMockFetch } from '../../mocks/typescript'
 *
 * Node.js-only exports (for E2E tests, build scripts):
 *   import { loadTestAudioBase64 } from '../../mocks/typescript/audio-node'
 *
 * ⚠️  WARNING: This barrel file re-exports Node.js-only functions for convenience.
 * Do NOT import this file in browser code that gets bundled (e.g., frontend src/).
 * Bundlers (Vite, Webpack) will fail at BUILD TIME when trying to resolve `fs` and `path`.
 * For browser code, import specific functions from './audio' or './fetch' instead.
 */

// Audio mocks (browser-compatible)
export {
  createFakeMediaStream,
  createMockAudioContext,
  createMockMediaRecorder,
  createMockSpeechRecognition,
  createWavBlob,
  generateWavBase64,
  generateWavBytes,
  type SpeechRecognitionMockConfig,
  type WavConfig,
} from "./audio";

// Node.js-only audio utilities
// ⚠️  These use `fs` and `path` - importing them in browser bundles causes BUILD errors, not runtime errors.
// Only use in Node.js contexts: E2E tests (Playwright), build scripts, CLI tools.
export {
  createWavBuffer,
  loadTestAudioBase64,
  saveWavFile,
  TEST_AUDIO_PATH,
  testAudioFixtureExists,
} from "./audio-node";

// Fetch/API mocks
export {
  createMockFetch,
  createMockFetchError,
  createMockFetchResponse,
  createMockNetworkError,
  mockResponses,
  type HealthResponse,
  type LexicalResponse,
  type ProsodicResponse,
} from "./fetch";

// Re-export fixtures as modules
import apiResponses from "../api/responses.json";
import testPhrases from "../fixtures/test-phrases.json";

export { apiResponses, testPhrases };
