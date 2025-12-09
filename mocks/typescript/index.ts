/**
 * Shared mocks for TypeScript environments (frontend tests, E2E tests, dev mode).
 *
 * Usage:
 *   import { createWavBlob, mockResponses, createMockFetch } from '../../mocks/typescript'
 */

// Audio mocks
export {
  createFakeMediaStream,
  createMockAudioContext,
  createMockMediaRecorder,
  createMockSpeechRecognition,
  createWavBlob,
  generateWavBase64,
  generateWavBytes,
  loadTestAudioBase64,
  type SpeechRecognitionMockConfig,
  type WavConfig,
} from "./audio";

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
