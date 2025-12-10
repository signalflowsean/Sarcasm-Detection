/**
 * Shared mocks for TypeScript environments.
 *
 * Browser-compatible exports (work everywhere):
 *   import { createWavBlob, mockResponses, createMockFetch } from '../../mocks/typescript'
 *
 * Node.js-only exports (for E2E tests, build scripts):
 *   import { loadTestAudioBase64 } from '../../mocks/typescript/audio-node'
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
// These are re-exported here for convenience but will fail in browser environments
export {
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
