import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createMockAudioBlob,
  createMockFetchError,
  createMockFetchResponse,
  mockLexicalResponse,
  mockProsodicResponse,
} from '../../test/mocks'
import { mergeAbortSignals, sendLexicalText, sendProsodicAudio } from './apiService'

describe('apiService', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('mergeAbortSignals', () => {
    describe('native AbortSignal.any() path', () => {
      beforeEach(() => {
        // Mock AbortSignal.any() as available
        if (typeof AbortSignal.any !== 'function') {
          ;(AbortSignal as unknown as { any: typeof AbortSignal.any }).any = vi.fn(
            (signals: AbortSignal[]) => {
              const controller = new AbortController()
              signals.forEach(signal => {
                if (signal.aborted) {
                  controller.abort()
                } else {
                  signal.addEventListener('abort', () => controller.abort(), { once: true })
                }
              })
              return controller.signal
            }
          )
        }
      })

      afterEach(() => {
        // Restore original AbortSignal if it was mocked
        if (typeof AbortSignal.any === 'function' && vi.isMockFunction(AbortSignal.any)) {
          delete (AbortSignal as unknown as { any?: typeof AbortSignal.any }).any
        }
      })

      it('should use native AbortSignal.any() when available', () => {
        const signal1 = new AbortController().signal
        const signal2 = new AbortController().signal

        const result = mergeAbortSignals([signal1, signal2])

        expect(result.signal).toBeDefined()
        expect(result.cleanup).toBeUndefined() // Native path doesn't return cleanup
        expect(result.signal.aborted).toBe(false)
      })

      it('should abort merged signal when any input signal aborts', () => {
        const controller1 = new AbortController()
        const controller2 = new AbortController()
        const signal1 = controller1.signal
        const signal2 = controller2.signal

        const result = mergeAbortSignals([signal1, signal2])

        expect(result.signal.aborted).toBe(false)

        controller1.abort()

        expect(result.signal.aborted).toBe(true)
      })

      it('should handle already aborted signals', () => {
        const controller1 = new AbortController()
        controller1.abort()
        const signal1 = controller1.signal
        const signal2 = new AbortController().signal

        const result = mergeAbortSignals([signal1, signal2])

        expect(result.signal.aborted).toBe(true)
      })
    })

    describe('fallback path (no AbortSignal.any())', () => {
      let originalAbortSignalAny: typeof AbortSignal.any | undefined

      beforeEach(() => {
        // Save original if it exists
        originalAbortSignalAny = (AbortSignal as unknown as { any?: typeof AbortSignal.any }).any
        // Remove AbortSignal.any() to force fallback path
        delete (AbortSignal as unknown as { any?: typeof AbortSignal.any }).any
      })

      afterEach(() => {
        // Restore original if it existed
        if (originalAbortSignalAny) {
          ;(AbortSignal as unknown as { any?: typeof AbortSignal.any }).any = originalAbortSignalAny
        }
      })

      it('should use fallback implementation when AbortSignal.any() is not available', () => {
        const signal1 = new AbortController().signal
        const signal2 = new AbortController().signal

        const result = mergeAbortSignals([signal1, signal2])

        expect(result.signal).toBeDefined()
        expect(result.cleanup).toBeDefined() // Fallback path returns cleanup
        expect(result.signal.aborted).toBe(false)
      })

      it('should abort merged signal when any input signal aborts', () => {
        const controller1 = new AbortController()
        const controller2 = new AbortController()
        const signal1 = controller1.signal
        const signal2 = controller2.signal

        const result = mergeAbortSignals([signal1, signal2])

        expect(result.signal.aborted).toBe(false)

        controller1.abort()

        expect(result.signal.aborted).toBe(true)
      })

      it('should handle already aborted signals without adding listeners', () => {
        const controller1 = new AbortController()
        controller1.abort()
        const signal1 = controller1.signal
        const signal2 = new AbortController().signal

        const result = mergeAbortSignals([signal1, signal2])

        expect(result.signal.aborted).toBe(true)
        expect(result.cleanup).toBeUndefined() // No cleanup needed if already aborted
      })

      it('should handle multiple signals aborting', () => {
        const controller1 = new AbortController()
        const controller2 = new AbortController()
        const controller3 = new AbortController()
        const signal1 = controller1.signal
        const signal2 = controller2.signal
        const signal3 = controller3.signal

        const result = mergeAbortSignals([signal1, signal2, signal3])

        expect(result.signal.aborted).toBe(false)

        controller2.abort()

        expect(result.signal.aborted).toBe(true)
      })

      it('should call cleanup function to remove event listeners', () => {
        const controller1 = new AbortController()
        const controller2 = new AbortController()
        const signal1 = controller1.signal
        const signal2 = controller2.signal

        const result = mergeAbortSignals([signal1, signal2])

        expect(result.cleanup).toBeDefined()

        // Spy on removeEventListener to verify cleanup
        const removeSpy1 = vi.spyOn(signal1, 'removeEventListener')
        const removeSpy2 = vi.spyOn(signal2, 'removeEventListener')

        result.cleanup!()

        expect(removeSpy1).toHaveBeenCalled()
        expect(removeSpy2).toHaveBeenCalled()
      })

      it('should automatically clean up listeners when merged signal aborts', async () => {
        const controller1 = new AbortController()
        const controller2 = new AbortController()
        const signal1 = controller1.signal
        const signal2 = controller2.signal

        const result = mergeAbortSignals([signal1, signal2])

        // Spy on removeEventListener to verify automatic cleanup
        const removeSpy1 = vi.spyOn(signal1, 'removeEventListener')
        const removeSpy2 = vi.spyOn(signal2, 'removeEventListener')

        // Abort one of the signals, which should trigger cleanup via the abort event listener
        controller1.abort()

        // Wait for the abort event to propagate and trigger cleanup
        await new Promise<void>(resolve => setTimeout(resolve, 10))

        expect(result.signal.aborted).toBe(true)
        expect(removeSpy1).toHaveBeenCalled()
        expect(removeSpy2).toHaveBeenCalled()
      })

      it('should handle empty signals array', () => {
        const result = mergeAbortSignals([])

        expect(result.signal).toBeDefined()
        expect(result.signal.aborted).toBe(false)
      })

      it('should handle single signal', () => {
        const controller = new AbortController()
        const signal = controller.signal

        const result = mergeAbortSignals([signal])

        expect(result.signal).toBeDefined()
        expect(result.cleanup).toBeDefined()

        controller.abort()

        expect(result.signal.aborted).toBe(true)
      })
    })
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

    it('should treat AbortError from user cancellation as connection error', async () => {
      // When fetch is aborted by user (not timeout), it should be treated as a connection error
      vi.mocked(fetch).mockRejectedValueOnce(
        Object.assign(new Error('signal is aborted without reason'), { name: 'AbortError' })
      )

      const error = await sendLexicalText('test').catch(e => e)
      expect(error.message).toContain('Failed to connect to server')
      expect(error.message).toContain('signal is aborted without reason')
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
      // Create a blob larger than 10MB
      const largeData = new Uint8Array(11 * 1024 * 1024) // 11MB
      const largeBlob = new Blob([largeData], { type: 'audio/wav' })
      await expect(sendProsodicAudio(largeBlob)).rejects.toThrow(
        'Audio file exceeds maximum size of 10MB'
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

    it('should treat AbortError from user cancellation as connection error', async () => {
      // When fetch is aborted by user (not timeout), it should be treated as a connection error
      vi.mocked(fetch).mockRejectedValueOnce(
        Object.assign(new Error('signal is aborted without reason'), { name: 'AbortError' })
      )

      const audioBlob = createMockAudioBlob()
      const error = await sendProsodicAudio(audioBlob).catch(e => e)
      expect(error.message).toContain('Failed to connect to server')
      expect(error.message).toContain('signal is aborted without reason')
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
