import { act, renderHook, waitFor } from '@testing-library/react'
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
    it('should transition from idle to loading to listening', async () => {
      const options = createMockOptions()
      const { result } = renderHook(() => useSpeechRecognition(options))

      expect(result.current.speechStatus).toBe('idle')

      await act(async () => {
        result.current.startSpeechRecognition()
      })

      await waitFor(() => {
        expect(result.current.speechStatus).toBe('listening')
      })
    })

    it('should create MicrophoneTranscriber with correct parameters', async () => {
      const options = createMockOptions()
      const { result } = renderHook(() => useSpeechRecognition(options))

      await act(async () => {
        await result.current.startSpeechRecognition()
      })

      expect(Moonshine.MicrophoneTranscriber).toHaveBeenCalledWith(
        'model/tiny', // Default model
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

      // Simulate committed transcript
      act(() => {
        capturedCallbacks.onTranscriptionCommitted?.('Hello world')
      })

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
    it('should handle NotAllowedError (permission denied)', async () => {
      const notAllowedError = new Error('Permission denied')
      notAllowedError.name = 'NotAllowedError'
      mockTranscriber.start.mockRejectedValueOnce(notAllowedError)

      const options = createMockOptions()
      const { result } = renderHook(() => useSpeechRecognition(options))

      await act(async () => {
        await result.current.startSpeechRecognition()
      })

      expect(options.onError).toHaveBeenCalledWith(
        'Microphone access denied. Please allow microphone access.'
      )
      expect(result.current.speechStatus).toBe('error')
    })

    it('should handle NotFoundError (no microphone)', async () => {
      const notFoundError = new Error('No device found')
      notFoundError.name = 'NotFoundError'
      mockTranscriber.start.mockRejectedValueOnce(notFoundError)

      const options = createMockOptions()
      const { result } = renderHook(() => useSpeechRecognition(options))

      await act(async () => {
        await result.current.startSpeechRecognition()
      })

      expect(options.onError).toHaveBeenCalledWith(
        'No microphone found. Please connect a microphone.'
      )
      expect(result.current.speechStatus).toBe('error')
    })

    it('should handle generic Error with message', async () => {
      mockTranscriber.start.mockRejectedValueOnce(new Error('Something went wrong'))

      const options = createMockOptions()
      const { result } = renderHook(() => useSpeechRecognition(options))

      await act(async () => {
        await result.current.startSpeechRecognition()
      })

      expect(options.onError).toHaveBeenCalledWith('Speech recognition error: Something went wrong')
      expect(result.current.speechStatus).toBe('error')
    })

    it('should handle permission keyword in error message', async () => {
      const permissionError = new Error('User denied permission')
      mockTranscriber.start.mockRejectedValueOnce(permissionError)

      const options = createMockOptions()
      const { result } = renderHook(() => useSpeechRecognition(options))

      await act(async () => {
        await result.current.startSpeechRecognition()
      })

      expect(options.onError).toHaveBeenCalledWith(
        'Microphone access denied. Please allow microphone access.'
      )
    })

    it('should handle string errors', async () => {
      mockTranscriber.start.mockRejectedValueOnce('String error message')

      const options = createMockOptions()
      const { result } = renderHook(() => useSpeechRecognition(options))

      await act(async () => {
        await result.current.startSpeechRecognition()
      })

      expect(options.onError).toHaveBeenCalledWith(
        'Failed to start speech recognition: String error message'
      )
    })

    it('should handle object errors', async () => {
      mockTranscriber.start.mockRejectedValueOnce({ code: 'ERR_001', detail: 'test' })

      const options = createMockOptions()
      const { result } = renderHook(() => useSpeechRecognition(options))

      await act(async () => {
        await result.current.startSpeechRecognition()
      })

      expect(options.onError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to start speech recognition:')
      )
    })
  })

  describe('resetSpeechStatus', () => {
    it('should reset to idle when not recording', async () => {
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

      expect(result.current.speechStatus).toBe('idle')
    })

    it('should reset to listening when recording', async () => {
      const options = createMockOptions()
      options.isRecordingRef.current = true

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

    it('should handle unmount during async start', async () => {
      // Make start take longer
      mockTranscriber.start.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      )

      const options = createMockOptions()
      const { result, unmount } = renderHook(() => useSpeechRecognition(options))

      // Start but don't wait
      act(() => {
        result.current.startSpeechRecognition()
      })

      // Unmount immediately
      unmount()

      // Wait for the start to complete
      await new Promise(resolve => setTimeout(resolve, 150))

      // Should have called stop after start completed
      expect(mockTranscriber.stop).toHaveBeenCalled()
    })

    it('should not update state after unmount on error', async () => {
      mockTranscriber.start.mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('test')), 100))
      )

      const options = createMockOptions()
      const { result, unmount } = renderHook(() => useSpeechRecognition(options))

      // Start but don't wait
      act(() => {
        result.current.startSpeechRecognition()
      })

      // Unmount immediately
      unmount()

      // Wait for the error
      await new Promise(resolve => setTimeout(resolve, 150))

      // onError should NOT be called after unmount
      expect(options.onError).not.toHaveBeenCalled()
    })
  })
})
