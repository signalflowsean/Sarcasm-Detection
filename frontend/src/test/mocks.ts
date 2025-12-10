/**
 * Test mocks for frontend tests.
 * Re-exports from shared mocks for convenience.
 */

// Re-export everything from shared mocks
export {
  apiResponses,
  createFakeMediaStream,
  createMockAudioContext,
  createMockFetch,
  createMockFetchError,
  createMockFetchResponse,
  createMockMediaRecorder,
  createMockNetworkError,
  createMockSpeechRecognition,
  createWavBlob,
  generateWavBase64,
  // Audio
  generateWavBytes,
  // Fetch/API
  mockResponses,
  // Fixtures
  testPhrases,
  type HealthResponse,
  type LexicalResponse,
  type ProsodicResponse,
  type SpeechRecognitionMockConfig,
  type WavConfig,
} from '../../../mocks/typescript'

// Convenient aliases for backward compatibility
import { createWavBlob, mockResponses } from '../../../mocks/typescript'

export const mockLexicalResponse = mockResponses.lexical.sarcastic
export const mockProsodicResponse = mockResponses.prosodic.sarcastic
export const mockUnreliableLexicalResponse = mockResponses.lexical.unreliable

/**
 * Create a minimal audio blob for testing.
 * @deprecated Use createWavBlob() from shared mocks instead
 */
export function createMockAudioBlob(): Blob {
  return createWavBlob()
}
