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
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Request-ID': expect.any(String),
          }),
          body: JSON.stringify({ text: 'Test text' }),
        })
      )
      expect(result).toEqual(mockLexicalResponse)
    })

    it('should validate empty text before sending', async () => {
      await expect(sendLexicalText('')).rejects.toThrow('Text cannot be empty')
      expect(fetch).not.toHaveBeenCalled()
    })

    it('should validate whitespace-only text before sending', async () => {
      await expect(sendLexicalText('   ')).rejects.toThrow('Text cannot be empty')
      expect(fetch).not.toHaveBeenCalled()
    })

    it('should validate text length before sending', async () => {
      const longText = 'a'.repeat(10001) // Exceeds MAX_TEXT_LENGTH
      await expect(sendLexicalText(longText)).rejects.toThrow(
        'Text exceeds maximum length of 10,000 characters'
      )
      expect(fetch).not.toHaveBeenCalled()
    })

    it('should throw error on failed request', async () => {
      vi.mocked(fetch).mockReturnValueOnce(createMockFetchError('Text must be a non-empty string'))

      await expect(sendLexicalText('test')).rejects.toThrow('Text must be a non-empty string')
    })

    it('should handle network errors', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      const error = await sendLexicalText('test').catch(e => e)
      expect(error.message).toContain('Failed to connect to server')
      expect(error.message).toContain('Network error')
    })

    it('should handle timeout errors', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(
        Object.assign(new Error('signal is aborted without reason'), { name: 'AbortError' })
      )

      await expect(sendLexicalText('test')).rejects.toThrow(
        'Request timed out - server took too long to respond'
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
          headers: expect.objectContaining({
            'X-Request-ID': expect.any(String),
          }),
        })
      )
      expect(result).toEqual(mockProsodicResponse)
    })

    it('should validate empty audio before sending', async () => {
      const emptyBlob = new Blob([], { type: 'audio/wav' })
      await expect(sendProsodicAudio(emptyBlob)).rejects.toThrow('Audio file is empty')
      expect(fetch).not.toHaveBeenCalled()
    })

    it('should validate audio size before sending', async () => {
      // Create a blob larger than 50MB
      const largeData = new Uint8Array(51 * 1024 * 1024) // 51MB
      const largeBlob = new Blob([largeData], { type: 'audio/wav' })
      await expect(sendProsodicAudio(largeBlob)).rejects.toThrow(
        'Audio file exceeds maximum size of 50MB'
      )
      expect(fetch).not.toHaveBeenCalled()
    })

    it('should throw error on failed request', async () => {
      vi.mocked(fetch).mockReturnValueOnce(createMockFetchError('No audio file provided'))

      const audioBlob = createMockAudioBlob()
      await expect(sendProsodicAudio(audioBlob)).rejects.toThrow('No audio file provided')
    })

    it('should handle network errors', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Failed to fetch'))

      const audioBlob = createMockAudioBlob()
      const error = await sendProsodicAudio(audioBlob).catch(e => e)
      expect(error.message).toContain('Failed to connect to server')
      expect(error.message).toContain('Failed to fetch')
    })

    it('should handle timeout errors', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(
        Object.assign(new Error('signal is aborted without reason'), { name: 'AbortError' })
      )

      const audioBlob = createMockAudioBlob()
      await expect(sendProsodicAudio(audioBlob)).rejects.toThrow(
        'Request timed out - server took too long to respond'
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
