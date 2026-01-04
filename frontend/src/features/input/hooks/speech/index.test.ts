import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSpeechRecognition } from './index'

// Mock MoonshineJS
vi.mock('@moonshine-ai/moonshine-js', () => {
  return {
    MicrophoneTranscriber: vi.fn(),
  }
})

// Mock Web Speech API support check to prevent preload from running in tests
vi.mock('./webSpeechEngine', async importOriginal => {
  const actual = await importOriginal<typeof import('./webSpeechEngine')>()
  return {
    ...actual,
    // Return true so preload doesn't kick in during tests
    isWebSpeechSupported: () => true,
  }
})

// Mock moonshine preload to prevent side effects
vi.mock('./moonshineEngine', async importOriginal => {
  const actual = await importOriginal<typeof import('./moonshineEngine')>()
  return {
    ...actual,
    // No-op preload in tests
    preloadMoonshineModel: vi.fn().mockResolvedValue(undefined),
  }
})

import * as Moonshine from '@moonshine-ai/moonshine-js'

describe('useSpeechRecognition', () => {
  let mockTranscriber: {
    start: ReturnType<typeof vi.fn>
    stop: ReturnType<typeof vi.fn>
    // Note: isListening() does NOT exist in @moonshine-ai/moonshine-js v0.1.29
  }
  let capturedCallbacks: {
    onTranscriptionCommitted?: (text: string) => void
    onTranscriptionUpdated?: (text: string) => void
    onModelLoadStart?: () => void
    onModelLoadComplete?: () => void
    onError?: (error: Error) => void
  }

  const createMockOptions = () => ({
    isRecordingRef: { current: true },
    onTranscriptUpdate: vi.fn(),
    onError: vi.fn(),
  })

  beforeEach(() => {
    vi.resetAllMocks()

    // Create mock transcriber instance
    // Note: isListening() does NOT exist in @moonshine-ai/moonshine-js v0.1.29
    mockTranscriber = {
      start: vi.fn().mockImplementation(async () => {
        // After start, trigger callbacks to simulate ready state
        // Use setTimeout to allow test to inspect intermediate states if needed
        setTimeout(() => {
          if (capturedCallbacks.onModelLoadStart) {
            capturedCallbacks.onModelLoadStart()
          }
          if (capturedCallbacks.onModelLoadComplete) {
            capturedCallbacks.onModelLoadComplete()
          }
          // Simulate first transcript to trigger 'listening' status
          if (capturedCallbacks.onTranscriptionUpdated) {
            capturedCallbacks.onTranscriptionUpdated('')
          }
        }, 0)
      }),
      stop: vi.fn(),
    }

    // Capture callbacks when MicrophoneTranscriber is constructed
    vi.mocked(Moonshine.MicrophoneTranscriber).mockImplementation((_model, callbacks) => {
      capturedCallbacks = callbacks || {}
      return mockTranscriber as unknown as Moonshine.MicrophoneTranscriber
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initial state', () => {
    it('should start with idle status and no error', () => {
      const options = createMockOptions()
      const { result } = renderHook(() => useSpeechRecognition(options))

      expect(result.current.speechStatus).toBe('idle')
      expect(result.current.speechError).toBe(null)
    })

    it('should provide start and stop functions', () => {
      const options = createMockOptions()
      const { result } = renderHook(() => useSpeechRecognition(options))

      expect(typeof result.current.startSpeechRecognition).toBe('function')
      expect(typeof result.current.stopSpeechRecognition).toBe('function')
      expect(typeof result.current.resetSpeechStatus).toBe('function')
    })
  })

  describe('startSpeechRecognition', () => {
    it('should transition from idle to loading to listening via MoonshineJS callbacks', async () => {
      const options = createMockOptions()
      const { result } = renderHook(() => useSpeechRecognition(options))

      expect(result.current.speechStatus).toBe('idle')

      // Start speech recognition - the mock auto-triggers callbacks via setTimeout
      // so we need to flush timers after starting
      await act(async () => {
        await result.current.startSpeechRecognition()
        // Allow setTimeout callbacks to run
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      // After start completes, status should be 'listening' (callbacks were auto-triggered)
      expect(result.current.speechStatus).toBe('listening')
    })

    it('should create MicrophoneTranscriber with default model when env not set', async () => {
      const options = createMockOptions()
      const { result } = renderHook(() => useSpeechRecognition(options))

      await act(async () => {
        await result.current.startSpeechRecognition()
      })

      expect(Moonshine.MicrophoneTranscriber).toHaveBeenCalledWith(
        'model/base', // Default model (base chosen for better accuracy - 10-12% WER vs 15-20% for tiny)
        expect.objectContaining({
          onTranscriptionCommitted: expect.any(Function),
          onTranscriptionUpdated: expect.any(Function),
        }),
        false // VAD disabled
      )
    })

    it('should not start if already running', async () => {
      const options = createMockOptions()
      const { result } = renderHook(() => useSpeechRecognition(options))

      await act(async () => {
        await result.current.startSpeechRecognition()
      })

      // Try to start again
      await act(async () => {
        await result.current.startSpeechRecognition()
      })

      // Should only have been constructed once
      expect(Moonshine.MicrophoneTranscriber).toHaveBeenCalledTimes(1)
    })
  })

  describe('stopSpeechRecognition', () => {
    it('should stop transcriber and reset to idle with no error', async () => {
      const options = createMockOptions()
      const { result } = renderHook(() => useSpeechRecognition(options))

      await act(async () => {
        await result.current.startSpeechRecognition()
      })

      // Simulate the callbacks that would normally set status to listening
      act(() => {
        capturedCallbacks.onModelLoadComplete?.()
        // First transcript triggers 'listening' status (VAD ready)
        capturedCallbacks.onTranscriptionUpdated?.('hello')
      })

      expect(result.current.speechStatus).toBe('listening')

      act(() => {
        result.current.stopSpeechRecognition()
      })

      expect(mockTranscriber.stop).toHaveBeenCalled()
      expect(result.current.speechStatus).toBe('idle')
      expect(result.current.speechError).toBe(null)
    })

    it('should handle stop when not running', () => {
      const options = createMockOptions()
      const { result } = renderHook(() => useSpeechRecognition(options))

      // Should not throw
      act(() => {
        result.current.stopSpeechRecognition()
      })

      expect(result.current.speechStatus).toBe('idle')
    })
  })

  describe('transcript callbacks', () => {
    it('should call onTranscriptUpdate for committed transcript when recording', async () => {
      const options = createMockOptions()
      options.isRecordingRef.current = true
      const { result } = renderHook(() => useSpeechRecognition(options))

      await act(async () => {
        await result.current.startSpeechRecognition()
      })

      // Set engine to listening state - onModelLoadComplete sets listening = true internally
      act(() => {
        capturedCallbacks.onModelLoadComplete?.()
      })

      // Simulate committed transcript via the moonshine callback
      act(() => {
        capturedCallbacks.onTranscriptionCommitted?.('Hello world')
      })

      // The hook wraps callbacks and checks isRecordingRef
      expect(options.onTranscriptUpdate).toHaveBeenCalledWith({
        interim: '',
        final: 'Hello world',
      })
    })

    it('should call onTranscriptUpdate for interim transcript when recording', async () => {
      const options = createMockOptions()
      options.isRecordingRef.current = true
      const { result } = renderHook(() => useSpeechRecognition(options))

      await act(async () => {
        await result.current.startSpeechRecognition()
      })

      // Set engine to listening state - onModelLoadComplete sets listening = true internally
      act(() => {
        capturedCallbacks.onModelLoadComplete?.()
      })

      // Simulate interim transcript
      act(() => {
        capturedCallbacks.onTranscriptionUpdated?.('Hello')
      })

      expect(options.onTranscriptUpdate).toHaveBeenCalledWith({
        interim: 'Hello',
        final: '',
      })
    })

    it('should NOT call onTranscriptUpdate when not recording', async () => {
      const options = createMockOptions()
      options.isRecordingRef.current = false
      const { result } = renderHook(() => useSpeechRecognition(options))

      await act(async () => {
        await result.current.startSpeechRecognition()
      })

      // Simulate transcripts while not recording
      act(() => {
        capturedCallbacks.onTranscriptionCommitted?.('Hello world')
        capturedCallbacks.onTranscriptionUpdated?.('Hello')
      })

      expect(options.onTranscriptUpdate).not.toHaveBeenCalled()
    })

    it('should ignore empty committed transcripts', async () => {
      const options = createMockOptions()
      options.isRecordingRef.current = true
      const { result } = renderHook(() => useSpeechRecognition(options))

      await act(async () => {
        await result.current.startSpeechRecognition()
        // Allow setTimeout callbacks to run
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      // Clear mock calls from the initial auto-triggered callbacks
      options.onTranscriptUpdate.mockClear()

      // Simulate empty/whitespace committed transcripts
      act(() => {
        capturedCallbacks.onTranscriptionCommitted?.('')
        capturedCallbacks.onTranscriptionCommitted?.('   ')
      })

      // Should not be called for empty committed transcripts (final is filtered)
      expect(options.onTranscriptUpdate).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should handle runtime transcription errors via onError callback and set speechError', async () => {
      const options = createMockOptions()
      const { result } = renderHook(() => useSpeechRecognition(options))

      // Start successfully first
      await act(async () => {
        await result.current.startSpeechRecognition()
      })

      // Simulate runtime error during transcription
      const runtimeError = new Error('Audio processing failed')
      act(() => {
        capturedCallbacks.onError?.(runtimeError)
      })

      expect(options.onError).toHaveBeenCalledWith('Transcription error: Audio processing failed')
      expect(result.current.speechStatus).toBe('error')
      expect(result.current.speechError).toBe('Transcription error: Audio processing failed')
    })

    it('should show error and set speechError when MoonshineJS fails (Web Speech API not available in test env)', async () => {
      mockTranscriber.start.mockRejectedValueOnce(new Error('MoonshineJS failed'))

      const options = createMockOptions()
      const { result } = renderHook(() => useSpeechRecognition(options))

      await act(async () => {
        await result.current.startSpeechRecognition()
      })

      // Web Speech API is tried first but not available in test environment
      // Then MoonshineJS is tried as fallback, but we made it fail
      // Error message format depends on environment (dev shows technical details, prod shows user-friendly)
      const errorMessage = options.onError.mock.calls[0]?.[0]
      expect(errorMessage).toBeTruthy()
      // Both formats include the base message; dev includes technical details
      expect(errorMessage).toContain('Speech recognition failed')
      // In development, technical details are included; in production, user-friendly message only
      // Check that either format is present (flexible for both environments)
      const hasTechnicalDetails =
        errorMessage.includes('MoonshineJS') || errorMessage.includes('Web Speech API')
      const hasUserFriendlyMessage = errorMessage.includes('Please try again')
      expect(hasTechnicalDetails || hasUserFriendlyMessage).toBe(true)
      expect(result.current.speechStatus).toBe('error')
      // Verify speechError is also set with the same message
      expect(result.current.speechError).toBe(errorMessage)
    })
  })

  describe('resetSpeechStatus', () => {
    it('should reset to idle and clear speechError when transcriber is not running', async () => {
      const options = createMockOptions()
      options.isRecordingRef.current = false

      // Force error state first
      mockTranscriber.start.mockRejectedValueOnce(new Error('test'))
      const { result } = renderHook(() => useSpeechRecognition(options))

      await act(async () => {
        await result.current.startSpeechRecognition()
      })

      expect(result.current.speechStatus).toBe('error')
      expect(result.current.speechError).toBeTruthy()

      act(() => {
        result.current.resetSpeechStatus()
      })

      // Should be idle because transcriber is null after error
      expect(result.current.speechStatus).toBe('idle')
      // speechError should also be cleared
      expect(result.current.speechError).toBe(null)
    })

    it('should reset to listening when transcriber is running and recording', async () => {
      const options = createMockOptions()
      options.isRecordingRef.current = true
      const { result } = renderHook(() => useSpeechRecognition(options))

      // Start successfully
      await act(async () => {
        await result.current.startSpeechRecognition()
      })

      // Simulate the callbacks that would normally set status to listening
      act(() => {
        capturedCallbacks.onModelLoadComplete?.()
        // First transcript triggers 'listening' status (VAD ready)
        capturedCallbacks.onTranscriptionUpdated?.('hello')
      })

      expect(result.current.speechStatus).toBe('listening')

      // Reset should stay listening since transcriber is running
      act(() => {
        result.current.resetSpeechStatus()
      })

      expect(result.current.speechStatus).toBe('listening')
    })
  })

  describe('cleanup on unmount', () => {
    it('should stop transcriber on unmount', async () => {
      const options = createMockOptions()
      const { result, unmount } = renderHook(() => useSpeechRecognition(options))

      await act(async () => {
        await result.current.startSpeechRecognition()
      })

      unmount()

      expect(mockTranscriber.stop).toHaveBeenCalled()
    })
  })
})
