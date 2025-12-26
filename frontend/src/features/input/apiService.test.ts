import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createMockAudioBlob,
  createMockFetchError,
  createMockFetchResponse,
  mockLexicalResponse,
  mockProsodicResponse,
} from '../../test/mocks'
import { sendLexicalText, sendProsodicAudio } from './apiService'

describe('apiService', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('sendLexicalText', () => {
    it('should send text and return response', async () => {
      vi.mocked(fetch).mockReturnValueOnce(
        Promise.resolve(createMockFetchResponse(mockLexicalResponse))
      )

      const result = await sendLexicalText('Test text')

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/lexical'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: 'Test text' }),
        })
      )
      expect(result).toEqual(mockLexicalResponse)
    })

    it('should throw error on failed request', async () => {
      vi.mocked(fetch).mockReturnValueOnce(createMockFetchError('Text must be a non-empty string'))

      await expect(sendLexicalText('')).rejects.toThrow('Text must be a non-empty string')
    })

    it('should handle network errors', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      await expect(sendLexicalText('test')).rejects.toThrow(
        'Failed to connect to server: Network error'
      )
    })

    it('should handle non-JSON error responses', async () => {
      vi.mocked(fetch).mockReturnValueOnce(
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: () => Promise.reject(new Error('Invalid JSON')),
        } as Response)
      )

      await expect(sendLexicalText('test')).rejects.toThrow('HTTP 500: Internal Server Error')
    })

    it('should handle invalid JSON in successful response', async () => {
      vi.mocked(fetch).mockReturnValueOnce(
        Promise.resolve({
          ok: true,
          json: () => Promise.reject(new Error('Invalid JSON')),
        } as Response)
      )

      await expect(sendLexicalText('test')).rejects.toThrow('Invalid response format from server')
    })

    it('should reject response with invalid structure', async () => {
      vi.mocked(fetch).mockReturnValueOnce(
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ invalid: 'structure' }), // Missing required fields
        } as Response)
      )

      await expect(sendLexicalText('test')).rejects.toThrow('Invalid response format from server')
    })

    it('should handle error response without error field', async () => {
      vi.mocked(fetch).mockReturnValueOnce(
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: () => Promise.resolve({ message: 'Something went wrong' }), // Not ErrorResponse format
        } as Response)
      )

      await expect(sendLexicalText('test')).rejects.toThrow('HTTP 500')
    })
  })

  describe('sendProsodicAudio', () => {
    it('should send audio and return response', async () => {
      vi.mocked(fetch).mockReturnValueOnce(
        Promise.resolve(createMockFetchResponse(mockProsodicResponse))
      )

      const audioBlob = createMockAudioBlob()
      const result = await sendProsodicAudio(audioBlob)

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/prosodic'),
        expect.objectContaining({
          method: 'POST',
        })
      )
      expect(result).toEqual(mockProsodicResponse)
    })

    it('should throw error on failed request', async () => {
      vi.mocked(fetch).mockReturnValueOnce(createMockFetchError('No audio file provided'))

      const audioBlob = createMockAudioBlob()
      await expect(sendProsodicAudio(audioBlob)).rejects.toThrow('No audio file provided')
    })

    it('should handle network errors', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Failed to fetch'))

      const audioBlob = createMockAudioBlob()
      await expect(sendProsodicAudio(audioBlob)).rejects.toThrow(
        'Failed to connect to server: Failed to fetch'
      )
    })

    it('should handle non-JSON error responses', async () => {
      vi.mocked(fetch).mockReturnValueOnce(
        Promise.resolve({
          ok: false,
          status: 413,
          statusText: 'Payload Too Large',
          json: () => Promise.reject(new Error('Invalid JSON')),
        } as Response)
      )

      const audioBlob = createMockAudioBlob()
      await expect(sendProsodicAudio(audioBlob)).rejects.toThrow('HTTP 413: Payload Too Large')
    })

    it('should handle invalid JSON in successful response', async () => {
      vi.mocked(fetch).mockReturnValueOnce(
        Promise.resolve({
          ok: true,
          json: () => Promise.reject(new Error('Invalid JSON')),
        } as Response)
      )

      const audioBlob = createMockAudioBlob()
      await expect(sendProsodicAudio(audioBlob)).rejects.toThrow(
        'Invalid response format from server'
      )
    })

    it('should reject response with invalid structure', async () => {
      vi.mocked(fetch).mockReturnValueOnce(
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ invalid: 'structure' }), // Missing required fields
        } as Response)
      )

      const audioBlob = createMockAudioBlob()
      await expect(sendProsodicAudio(audioBlob)).rejects.toThrow(
        'Invalid response format from server'
      )
    })

    it('should handle error response without error field', async () => {
      vi.mocked(fetch).mockReturnValueOnce(
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: () => Promise.resolve({ message: 'Something went wrong' }), // Not ErrorResponse format
        } as Response)
      )

      const audioBlob = createMockAudioBlob()
      await expect(sendProsodicAudio(audioBlob)).rejects.toThrow('HTTP 500')
    })
  })
})
