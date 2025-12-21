import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSpeechRecognition } from './useSpeechRecognition'

// Mock MoonshineJS
vi.mock('@moonshine-ai/moonshine-js', () => {
  return {
    MicrophoneTranscriber: vi.fn(),
  }
})

import * as Moonshine from '@moonshine-ai/moonshine-js'

describe('useSpeechRecognition', () => {
  let mockTranscriber: {
    start: ReturnType<typeof vi.fn>
    stop: ReturnType<typeof vi.fn>
    isListening: ReturnType<typeof vi.fn>
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
    mockTranscriber = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn(),
      isListening: vi.fn().mockReturnValue(false),
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
    it('should start with idle status', () => {
      const options = createMockOptions()
      const { result } = renderHook(() => useSpeechRecognition(options))

      expect(result.current.speechStatus).toBe('idle')
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

      // Start speech recognition
      await act(async () => {
        await result.current.startSpeechRecognition()
      })

      // Simulate MoonshineJS callbacks
      act(() => {
        capturedCallbacks.onModelLoadStart?.()
      })
      expect(result.current.speechStatus).toBe('loading')

      // Simulate model load completion and listening start
      mockTranscriber.isListening.mockReturnValue(true)
      act(() => {
        capturedCallbacks.onModelLoadComplete?.()
      })
      expect(result.current.speechStatus).toBe('listening')
    })

    it('should create MicrophoneTranscriber with default model when env not set', async () => {
      const options = createMockOptions()
      const { result } = renderHook(() => useSpeechRecognition(options))

      await act(async () => {
        await result.current.startSpeechRecognition()
      })

      expect(Moonshine.MicrophoneTranscriber).toHaveBeenCalledWith(
        'model/base', // Default model
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
    it('should stop transcriber and reset to idle', async () => {
      const options = createMockOptions()
      const { result } = renderHook(() => useSpeechRecognition(options))

      await act(async () => {
        await result.current.startSpeechRecognition()
      })

      // Simulate the callbacks that would normally set status to listening
      mockTranscriber.isListening.mockReturnValue(true)
      act(() => {
        capturedCallbacks.onModelLoadComplete?.()
      })

      expect(result.current.speechStatus).toBe('listening')

      act(() => {
        result.current.stopSpeechRecognition()
      })

      expect(mockTranscriber.stop).toHaveBeenCalled()
      expect(result.current.speechStatus).toBe('idle')
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

      // Set engine to listening state (moonshineEngine checks `listening` internally)
      mockTranscriber.isListening.mockReturnValue(true)
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

      // Set engine to listening state
      mockTranscriber.isListening.mockReturnValue(true)
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
      })

      // Simulate empty/whitespace transcripts
      act(() => {
        capturedCallbacks.onTranscriptionCommitted?.('')
        capturedCallbacks.onTranscriptionCommitted?.('   ')
      })

      expect(options.onTranscriptUpdate).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should handle runtime transcription errors via onError callback', async () => {
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
    })

    it('should show error when MoonshineJS fails and no fallback available', async () => {
      mockTranscriber.start.mockRejectedValueOnce(new Error('MoonshineJS failed'))

      const options = createMockOptions()
      const { result } = renderHook(() => useSpeechRecognition(options))

      await act(async () => {
        await result.current.startSpeechRecognition()
      })

      // Web Speech API is not available in test environment
      // Error message now includes information about both engine failures
      expect(options.onError).toHaveBeenCalledWith(
        'Speech recognition is not available in this browser. MoonshineJS: MoonshineJS failed Web Speech API: not supported'
      )
      expect(result.current.speechStatus).toBe('error')
    })
  })

  describe('resetSpeechStatus', () => {
    it('should reset to idle when transcriber is not running', async () => {
      const options = createMockOptions()
      options.isRecordingRef.current = false

      // Force error state first
      mockTranscriber.start.mockRejectedValueOnce(new Error('test'))
      const { result } = renderHook(() => useSpeechRecognition(options))

      await act(async () => {
        await result.current.startSpeechRecognition()
      })

      expect(result.current.speechStatus).toBe('error')

      act(() => {
        result.current.resetSpeechStatus()
      })

      // Should be idle because transcriber is null after error
      expect(result.current.speechStatus).toBe('idle')
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
      mockTranscriber.isListening.mockReturnValue(true)
      act(() => {
        capturedCallbacks.onModelLoadComplete?.()
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
