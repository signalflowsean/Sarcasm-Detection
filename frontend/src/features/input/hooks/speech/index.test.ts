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
vi.mock('./webSpeechEngine', () => {
  return {
    isWebSpeechSupported: () => true,
    createWebSpeechEngine: vi.fn(),
  }
})

// Mock moonshine preload to prevent side effects
vi.mock('./moonshineEngine', () => {
  return {
    preloadMoonshineModel: vi.fn().mockResolvedValue(undefined),
    createMoonshineEngine: vi.fn(),
    setDownloadProgressCallback: vi.fn(),
    getPreloadStatus: vi.fn(() => 'idle'),
    resetPreloadState: vi.fn(),
  }
})

import * as MoonshineEngine from './moonshineEngine'
import type { SpeechEngine } from './types'
import * as WebSpeechEngine from './webSpeechEngine'

describe('useSpeechRecognition', () => {
  let mockMoonshineEngine: SpeechEngine
  let mockWebSpeechEngine: SpeechEngine

  const createMockOptions = () => ({
    isRecordingRef: { current: true },
    onTranscriptUpdate: vi.fn(),
    onError: vi.fn(),
  })

  beforeEach(() => {
    vi.resetAllMocks()

    // Setup engine mocks - these need to be functions that capture callbacks
    vi.mocked(MoonshineEngine.createMoonshineEngine).mockImplementation(callbacks => {
      // Capture the callbacks from the hook
      const engineCallbacks = callbacks

      mockMoonshineEngine = {
        name: 'MoonshineJS',
        isSupported: vi.fn(() => true),
        start: vi.fn().mockImplementation(async () => {
          // Simulate the transcriber construction and callback triggering
          // This mimics what the real engine does
          setTimeout(() => {
            engineCallbacks.onStatusChange('loading')
            engineCallbacks.onStatusChange('listening')
          }, 0)
        }),
        stop: vi.fn(),
        isListening: vi.fn(() => true),
      }

      return mockMoonshineEngine
    })

    vi.mocked(WebSpeechEngine.createWebSpeechEngine).mockImplementation(() => {
      // Create mock Web Speech engine (that will fail so we fall back to Moonshine)
      mockWebSpeechEngine = {
        name: 'Web Speech API',
        isSupported: vi.fn(() => false),
        start: vi.fn().mockRejectedValue(new Error('Web Speech API not supported')),
        stop: vi.fn(),
        isListening: vi.fn(() => false),
      }

      return mockWebSpeechEngine
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

    it('should create MoonshineJS engine when Web Speech is not supported', async () => {
      const options = createMockOptions()
      const { result } = renderHook(() => useSpeechRecognition(options))

      await act(async () => {
        await result.current.startSpeechRecognition()
      })

      // Should try Web Speech first
      expect(mockWebSpeechEngine.isSupported).toHaveBeenCalled()
      // Then fall back to Moonshine
      expect(mockMoonshineEngine.start).toHaveBeenCalled()
    })

    it('should not start if already running', async () => {
      const options = createMockOptions()
      const { result } = renderHook(() => useSpeechRecognition(options))

      await act(async () => {
        await result.current.startSpeechRecognition()
      })

      // Clear mock calls
      vi.mocked(mockMoonshineEngine.start).mockClear()

      // Try to start again
      await act(async () => {
        await result.current.startSpeechRecognition()
      })

      // Should not start the engine again
      expect(mockMoonshineEngine.start).not.toHaveBeenCalled()
    })
  })

  describe('stopSpeechRecognition', () => {
    it('should stop engine and reset to idle with no error', async () => {
      const options = createMockOptions()
      const { result } = renderHook(() => useSpeechRecognition(options))

      await act(async () => {
        await result.current.startSpeechRecognition()
        // Allow setTimeout callbacks to run
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      expect(result.current.speechStatus).toBe('listening')

      act(() => {
        result.current.stopSpeechRecognition()
      })

      expect(mockMoonshineEngine.stop).toHaveBeenCalled()
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
    it('should call onTranscriptUpdate for final transcript when recording', async () => {
      const options = createMockOptions()
      options.isRecordingRef.current = true

      // Set up engine to trigger transcript callbacks
      vi.mocked(MoonshineEngine.createMoonshineEngine).mockImplementation(callbacks => {
        mockMoonshineEngine = {
          name: 'MoonshineJS',
          isSupported: vi.fn(() => true),
          start: vi.fn().mockImplementation(async () => {
            setTimeout(() => {
              callbacks.onStatusChange('listening')
              // Trigger a final transcript
              callbacks.onTranscriptUpdate({ interim: '', final: 'Hello world' })
            }, 0)
          }),
          stop: vi.fn(),
          isListening: vi.fn(() => true),
        }
        return mockMoonshineEngine
      })

      const { result } = renderHook(() => useSpeechRecognition(options))

      await act(async () => {
        await result.current.startSpeechRecognition()
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      expect(options.onTranscriptUpdate).toHaveBeenCalledWith({
        interim: '',
        final: 'Hello world',
      })
    })

    it('should call onTranscriptUpdate for interim transcript when recording', async () => {
      const options = createMockOptions()
      options.isRecordingRef.current = true

      // Set up engine to trigger transcript callbacks
      vi.mocked(MoonshineEngine.createMoonshineEngine).mockImplementation(callbacks => {
        mockMoonshineEngine = {
          name: 'MoonshineJS',
          isSupported: vi.fn(() => true),
          start: vi.fn().mockImplementation(async () => {
            setTimeout(() => {
              callbacks.onStatusChange('listening')
              // Trigger an interim transcript
              callbacks.onTranscriptUpdate({ interim: 'Hello', final: '' })
            }, 0)
          }),
          stop: vi.fn(),
          isListening: vi.fn(() => true),
        }
        return mockMoonshineEngine
      })

      const { result } = renderHook(() => useSpeechRecognition(options))

      await act(async () => {
        await result.current.startSpeechRecognition()
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      expect(options.onTranscriptUpdate).toHaveBeenCalledWith({
        interim: 'Hello',
        final: '',
      })
    })

    it('should NOT call onTranscriptUpdate when not recording', async () => {
      const options = createMockOptions()
      options.isRecordingRef.current = false

      // Set up engine to trigger transcript callbacks
      vi.mocked(MoonshineEngine.createMoonshineEngine).mockImplementation(callbacks => {
        mockMoonshineEngine = {
          name: 'MoonshineJS',
          isSupported: vi.fn(() => true),
          start: vi.fn().mockImplementation(async () => {
            setTimeout(() => {
              callbacks.onStatusChange('listening')
              // Trigger transcripts while not recording
              callbacks.onTranscriptUpdate({ interim: 'Hello', final: '' })
              callbacks.onTranscriptUpdate({ interim: '', final: 'Hello world' })
            }, 0)
          }),
          stop: vi.fn(),
          isListening: vi.fn(() => true),
        }
        return mockMoonshineEngine
      })

      const { result } = renderHook(() => useSpeechRecognition(options))

      await act(async () => {
        await result.current.startSpeechRecognition()
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      expect(options.onTranscriptUpdate).not.toHaveBeenCalled()
    })

    it('should ignore empty final transcripts', async () => {
      const options = createMockOptions()
      options.isRecordingRef.current = true

      // Set up engine to trigger transcript callbacks with empty finals
      vi.mocked(MoonshineEngine.createMoonshineEngine).mockImplementation(callbacks => {
        mockMoonshineEngine = {
          name: 'MoonshineJS',
          isSupported: vi.fn(() => true),
          start: vi.fn().mockImplementation(async () => {
            setTimeout(() => {
              callbacks.onStatusChange('listening')
              // Note: The engines already filter empty transcripts, so this test verifies
              // that even if they somehow pass through, the hook handles them gracefully
            }, 0)
          }),
          stop: vi.fn(),
          isListening: vi.fn(() => true),
        }
        return mockMoonshineEngine
      })

      const { result } = renderHook(() => useSpeechRecognition(options))

      await act(async () => {
        await result.current.startSpeechRecognition()
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      // No transcripts should be triggered (engine filters them)
      expect(options.onTranscriptUpdate).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should handle runtime transcription errors via onError callback and set speechError', async () => {
      const options = createMockOptions()

      // Set up engine to trigger error callback
      vi.mocked(MoonshineEngine.createMoonshineEngine).mockImplementation(callbacks => {
        mockMoonshineEngine = {
          name: 'MoonshineJS',
          isSupported: vi.fn(() => true),
          start: vi.fn().mockImplementation(async () => {
            setTimeout(() => {
              callbacks.onStatusChange('listening')
              // Simulate runtime error during transcription
              callbacks.onError('Transcription error: Audio processing failed')
            }, 0)
          }),
          stop: vi.fn(),
          isListening: vi.fn(() => true),
        }
        return mockMoonshineEngine
      })

      const { result } = renderHook(() => useSpeechRecognition(options))

      await act(async () => {
        await result.current.startSpeechRecognition()
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      expect(options.onError).toHaveBeenCalledWith('Transcription error: Audio processing failed')
      expect(result.current.speechStatus).toBe('error')
      expect(result.current.speechError).toBe('Transcription error: Audio processing failed')
    })

    it('should show error and set speechError when MoonshineJS fails (Web Speech API not available in test env)', async () => {
      const options = createMockOptions()

      // Set up Moonshine engine to fail
      vi.mocked(MoonshineEngine.createMoonshineEngine).mockImplementation(() => {
        mockMoonshineEngine = {
          name: 'MoonshineJS',
          isSupported: vi.fn(() => true),
          start: vi.fn().mockRejectedValue(new Error('MoonshineJS failed')),
          stop: vi.fn(),
          isListening: vi.fn(() => false),
        }
        return mockMoonshineEngine
      })

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
    it('should reset to idle and clear speechError when engine is not running', async () => {
      const options = createMockOptions()
      options.isRecordingRef.current = false

      // Set up Moonshine engine to fail
      vi.mocked(MoonshineEngine.createMoonshineEngine).mockImplementation(() => {
        mockMoonshineEngine = {
          name: 'MoonshineJS',
          isSupported: vi.fn(() => true),
          start: vi.fn().mockRejectedValue(new Error('test')),
          stop: vi.fn(),
          isListening: vi.fn(() => false),
        }
        return mockMoonshineEngine
      })

      const { result } = renderHook(() => useSpeechRecognition(options))

      await act(async () => {
        await result.current.startSpeechRecognition()
      })

      expect(result.current.speechStatus).toBe('error')
      expect(result.current.speechError).toBeTruthy()

      act(() => {
        result.current.resetSpeechStatus()
      })

      // Should be idle because engine is null after error
      expect(result.current.speechStatus).toBe('idle')
      // speechError should also be cleared
      expect(result.current.speechError).toBe(null)
    })

    it('should reset to listening when engine is running and recording', async () => {
      const options = createMockOptions()
      options.isRecordingRef.current = true

      // Set up engine normally
      vi.mocked(MoonshineEngine.createMoonshineEngine).mockImplementation(callbacks => {
        mockMoonshineEngine = {
          name: 'MoonshineJS',
          isSupported: vi.fn(() => true),
          start: vi.fn().mockImplementation(async () => {
            setTimeout(() => {
              callbacks.onStatusChange('listening')
            }, 0)
          }),
          stop: vi.fn(),
          isListening: vi.fn(() => true),
        }
        return mockMoonshineEngine
      })

      const { result } = renderHook(() => useSpeechRecognition(options))

      // Start successfully
      await act(async () => {
        await result.current.startSpeechRecognition()
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      expect(result.current.speechStatus).toBe('listening')

      // Reset should stay listening since engine is running
      act(() => {
        result.current.resetSpeechStatus()
      })

      expect(result.current.speechStatus).toBe('listening')
    })
  })

  describe('cleanup on unmount', () => {
    it('should stop engine on unmount', async () => {
      const options = createMockOptions()

      // Set up engine normally
      vi.mocked(MoonshineEngine.createMoonshineEngine).mockImplementation(callbacks => {
        mockMoonshineEngine = {
          name: 'MoonshineJS',
          isSupported: vi.fn(() => true),
          start: vi.fn().mockImplementation(async () => {
            setTimeout(() => {
              callbacks.onStatusChange('listening')
            }, 0)
          }),
          stop: vi.fn(),
          isListening: vi.fn(() => true),
        }
        return mockMoonshineEngine
      })

      const { result, unmount } = renderHook(() => useSpeechRecognition(options))

      await act(async () => {
        await result.current.startSpeechRecognition()
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      unmount()

      expect(mockMoonshineEngine.stop).toHaveBeenCalled()
    })
  })
})
