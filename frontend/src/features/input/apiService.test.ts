import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sendLexicalText, sendProsodicAudio } from './apiService'
import {
  mockLexicalResponse,
  mockProsodicResponse,
  createMockFetchResponse,
  createMockFetchError,
  createMockAudioBlob,
} from '../../test/mocks'

describe('apiService', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('sendLexicalText', () => {
    it('should send text and return response', async () => {
      vi.mocked(global.fetch).mockReturnValueOnce(
        createMockFetchResponse(mockLexicalResponse)
      )

      const result = await sendLexicalText('Test text')

      expect(global.fetch).toHaveBeenCalledWith(
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
      vi.mocked(global.fetch).mockReturnValueOnce(
        createMockFetchError('Text must be a non-empty string')
      )

      await expect(sendLexicalText('')).rejects.toThrow('Text must be a non-empty string')
    })

    it('should handle network errors', async () => {
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'))

      await expect(sendLexicalText('test')).rejects.toThrow('Network error')
    })
  })

  describe('sendProsodicAudio', () => {
    it('should send audio and return response', async () => {
      vi.mocked(global.fetch).mockReturnValueOnce(
        createMockFetchResponse(mockProsodicResponse)
      )

      const audioBlob = createMockAudioBlob()
      const result = await sendProsodicAudio(audioBlob)

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/prosodic'),
        expect.objectContaining({
          method: 'POST',
        })
      )
      expect(result).toEqual(mockProsodicResponse)
    })

    it('should throw error on failed request', async () => {
      vi.mocked(global.fetch).mockReturnValueOnce(
        createMockFetchError('No audio file provided')
      )

      const audioBlob = createMockAudioBlob()
      await expect(sendProsodicAudio(audioBlob)).rejects.toThrow('No audio file provided')
    })
  })
})

