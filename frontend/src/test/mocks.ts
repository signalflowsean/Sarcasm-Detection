/**
 * Test mocks for frontend tests.
 * Centralized location for all test mocks.
 */

import type { LexicalResponse, ProsodicResponse } from '../features/input/apiService'

// Mock API responses
export const mockLexicalResponse: LexicalResponse = {
  id: 'test-lexical-id',
  value: 0.75,
  reliable: true,
}

export const mockProsodicResponse: ProsodicResponse = {
  id: 'test-prosodic-id',
  value: 0.65,
  reliable: true,
}

export const mockUnreliableLexicalResponse: LexicalResponse = {
  id: 'test-unreliable-id',
  value: 0.5,
  reliable: false,
}

/**
 * Create a mock fetch response.
 */
export function createMockFetchResponse<T>(data: T, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(data),
  } as Response)
}

/**
 * Create a mock fetch that returns an error.
 */
export function createMockFetchError(error: string, status = 400) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({ error }),
  } as Response)
}

/**
 * Create a minimal audio blob for testing.
 */
export function createMockAudioBlob(): Blob {
  const header = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, // "RIFF"
    0x25, 0x00, 0x00, 0x00, // File size
    0x57, 0x41, 0x56, 0x45, // "WAVE"
  ])
  return new Blob([header], { type: 'audio/wav' })
}

