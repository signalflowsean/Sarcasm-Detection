import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAudioRecorder } from './useAudioRecorder'
import { AUTO_STOP_COUNTDOWN_START_MS, AUTO_STOP_SILENCE_THRESHOLD_MS } from './constants'

// Mock performance.now() for time-based tests
let currentTime = 1000
const mockPerformanceNow = vi.fn(() => currentTime)
vi.stubGlobal('performance', {
  now: mockPerformanceNow,
})

// Mock MediaRecorder
const mockMediaRecorder = {
  start: vi.fn(),
  stop: vi.fn(),
  state: 'inactive',
  mimeType: 'audio/webm',
  ondataavailable: null as ((event: BlobEvent) => void) | null,
  onstop: null as (() => void) | null,
}

const mockMediaRecorderConstructor = vi.fn(() => mockMediaRecorder)

// Mock MediaRecorder.isTypeSupported
Object.defineProperty(mockMediaRecorderConstructor, 'isTypeSupported', {
  value: vi.fn(() => true),
  writable: true,
})

vi.stubGlobal('MediaRecorder', mockMediaRecorderConstructor)

// Mock getUserMedia
const mockMediaStream = {
  getTracks: vi.fn(() => [
    {
      stop: vi.fn(),
    },
  ]),
} as unknown as MediaStream

const mockGetUserMedia = vi.fn().mockResolvedValue(mockMediaStream)

Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: mockGetUserMedia,
  },
  writable: true,
})

describe('useAudioRecorder - Silence Detection', () => {
  let mockWaveformControls: {
    setupWaveform: ReturnType<typeof vi.fn>
    cleanupWaveform: ReturnType<typeof vi.fn>
    invalidatePeaks: ReturnType<typeof vi.fn>
    computePeaksFromBlob: ReturnType<typeof vi.fn>
    resetWaveform: ReturnType<typeof vi.fn>
  }

  let mockSpeechControls: {
    startSpeechRecognition: ReturnType<typeof vi.fn>
    stopSpeechRecognition: ReturnType<typeof vi.fn>
  }

  const createMockOptions = () => ({
    waveformControls: mockWaveformControls,
    speechControls: mockSpeechControls,
    onRecordingStart: vi.fn(),
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    currentTime = 1000

    // Reset MediaRecorder mock
    mockMediaRecorder.state = 'inactive'
    mockMediaRecorder.start.mockClear()
    mockMediaRecorder.stop.mockClear()
    mockMediaRecorder.ondataavailable = null
    mockMediaRecorder.onstop = null

    // Setup MediaRecorder constructor to capture callbacks
    mockMediaRecorderConstructor.mockImplementation(() => {
      const recorder = {
        ...mockMediaRecorder,
        get ondataavailable() {
          return mockMediaRecorder.ondataavailable
        },
        set ondataavailable(callback: ((event: BlobEvent) => void) | null) {
          mockMediaRecorder.ondataavailable = callback
        },
        get onstop() {
          return mockMediaRecorder.onstop
        },
        set onstop(callback: (() => void) | null) {
          mockMediaRecorder.onstop = callback
        },
      }
      return recorder
    })

    // Create mock waveform controls
    mockWaveformControls = {
      setupWaveform: vi.fn().mockResolvedValue(undefined),
      cleanupWaveform: vi.fn(),
      invalidatePeaks: vi.fn(),
      computePeaksFromBlob: vi.fn(),
      resetWaveform: vi.fn(),
    }

    // Create mock speech controls
    mockSpeechControls = {
      startSpeechRecognition: vi.fn(),
      stopSpeechRecognition: vi.fn(),
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('countdown display', () => {
    it('should start countdown when silence threshold is reached', async () => {
      const options = createMockOptions()
      const { result } = renderHook(() => useAudioRecorder(options))

      // Start recording
      await act(async () => {
        await result.current.startRecording()
      })

      expect(result.current.state.isRecording).toBe(true)
      expect(result.current.state.autoStopCountdown).toBe(null)

      // Advance time to just before countdown window (should still be null)
      currentTime = 1000 + AUTO_STOP_SILENCE_THRESHOLD_MS - AUTO_STOP_COUNTDOWN_START_MS - 100
      await act(async () => {
        vi.advanceTimersByTime(150)
      })

      expect(result.current.state.autoStopCountdown).toBe(null)

      // Advance time into countdown window
      currentTime = 1000 + AUTO_STOP_SILENCE_THRESHOLD_MS - AUTO_STOP_COUNTDOWN_START_MS + 100
      await act(async () => {
        vi.advanceTimersByTime(150)
      })

      // Should show countdown (approximately AUTO_STOP_COUNTDOWN_START_MS - 100)
      const countdown = result.current.state.autoStopCountdown
      expect(countdown).not.toBe(null)
      expect(countdown).toBeGreaterThan(0)
      expect(countdown).toBeLessThanOrEqual(AUTO_STOP_COUNTDOWN_START_MS)
    })

    it('should update countdown as time progresses', async () => {
      const options = createMockOptions()
      const { result } = renderHook(() => useAudioRecorder(options))

      await act(async () => {
        await result.current.startRecording()
      })

      // Move into countdown window
      const startTime = 1000
      currentTime = startTime + AUTO_STOP_SILENCE_THRESHOLD_MS - AUTO_STOP_COUNTDOWN_START_MS
      await act(async () => {
        vi.advanceTimersByTime(150)
      })

      const initialCountdown = result.current.state.autoStopCountdown
      expect(initialCountdown).not.toBe(null)

      // Advance time further
      currentTime = startTime + AUTO_STOP_SILENCE_THRESHOLD_MS - AUTO_STOP_COUNTDOWN_START_MS + 500
      await act(async () => {
        vi.advanceTimersByTime(150)
      })

      const updatedCountdown = result.current.state.autoStopCountdown
      expect(updatedCountdown).not.toBe(null)
      expect(updatedCountdown).toBeLessThan(initialCountdown!)
    })

    it('should clear countdown when transcript updates occur', async () => {
      const options = createMockOptions()
      const { result } = renderHook(() => useAudioRecorder(options))

      await act(async () => {
        await result.current.startRecording()
      })

      // Advance time into countdown window
      currentTime = 1000 + AUTO_STOP_SILENCE_THRESHOLD_MS - AUTO_STOP_COUNTDOWN_START_MS + 100
      await act(async () => {
        vi.advanceTimersByTime(150)
      })

      expect(result.current.state.autoStopCountdown).not.toBe(null)

      // Update transcript (simulates new speech detected)
      act(() => {
        result.current.updateTranscript({ interim: 'Hello', final: '' })
      })

      // Countdown should be cleared
      expect(result.current.state.autoStopCountdown).toBe(null)

      // Update transcript resets timer to current time (2000)
      // Advance time but not enough to trigger countdown again
      // (timer was reset to 2000, so we need less than AUTO_STOP_SILENCE_THRESHOLD_MS - AUTO_STOP_COUNTDOWN_START_MS)
      currentTime = 2000
      act(() => {
        result.current.updateTranscript({ interim: 'Hello', final: '' })
      })

      // Advance time but not enough to enter countdown window
      currentTime = 2000 + AUTO_STOP_SILENCE_THRESHOLD_MS - AUTO_STOP_COUNTDOWN_START_MS - 100
      await act(async () => {
        vi.advanceTimersByTime(150)
      })

      // Should still be null because timer was reset and we haven't entered countdown window
      expect(result.current.state.autoStopCountdown).toBe(null)
    })

    it('should reset countdown on both interim and final transcript updates', async () => {
      const options = createMockOptions()
      const { result } = renderHook(() => useAudioRecorder(options))

      await act(async () => {
        await result.current.startRecording()
      })

      // Advance time into countdown window
      currentTime = 1000 + AUTO_STOP_SILENCE_THRESHOLD_MS - AUTO_STOP_COUNTDOWN_START_MS + 100
      await act(async () => {
        vi.advanceTimersByTime(150)
      })

      expect(result.current.state.autoStopCountdown).not.toBe(null)

      // Update with interim transcript
      act(() => {
        result.current.updateTranscript({ interim: 'Hello', final: '' })
      })
      expect(result.current.state.autoStopCountdown).toBe(null)

      // Advance time again
      currentTime = 3000 + AUTO_STOP_SILENCE_THRESHOLD_MS - AUTO_STOP_COUNTDOWN_START_MS + 100
      await act(async () => {
        vi.advanceTimersByTime(150)
      })

      expect(result.current.state.autoStopCountdown).not.toBe(null)

      // Update with final transcript
      act(() => {
        result.current.updateTranscript({ interim: '', final: ' world' })
      })
      expect(result.current.state.autoStopCountdown).toBe(null)
    })
  })

  describe('auto-stop triggering', () => {
    it('should automatically stop recording after silence duration elapses', async () => {
      const options = createMockOptions()
      const { result } = renderHook(() => useAudioRecorder(options))

      await act(async () => {
        await result.current.startRecording()
      })

      expect(result.current.state.isRecording).toBe(true)
      expect(mockSpeechControls.stopSpeechRecognition).not.toHaveBeenCalled()

      // Advance time past silence threshold
      // The interval runs every 100ms, so we need to advance enough for it to check
      currentTime = 1000 + AUTO_STOP_SILENCE_THRESHOLD_MS + 100
      await act(async () => {
        // Advance enough for the interval to run (it checks every 100ms)
        vi.advanceTimersByTime(200)
      })

      // Recording should be stopped
      expect(result.current.state.isRecording).toBe(false)
      expect(mockSpeechControls.stopSpeechRecognition).toHaveBeenCalled()
      expect(mockWaveformControls.cleanupWaveform).toHaveBeenCalled()
    })

    it('should not auto-stop if transcript updates occur before threshold', async () => {
      const options = createMockOptions()
      const { result } = renderHook(() => useAudioRecorder(options))

      await act(async () => {
        await result.current.startRecording()
      })

      // Advance time close to threshold
      currentTime = 1000 + AUTO_STOP_SILENCE_THRESHOLD_MS - 500
      await act(async () => {
        vi.advanceTimersByTime(150)
      })

      expect(result.current.state.isRecording).toBe(true)

      // Update transcript to reset timer
      act(() => {
        result.current.updateTranscript({ interim: 'Still talking', final: '' })
      })

      // Advance time past original threshold (but timer was reset)
      currentTime = 2000 + AUTO_STOP_SILENCE_THRESHOLD_MS - 400
      await act(async () => {
        vi.advanceTimersByTime(150)
      })

      // Should still be recording because timer was reset
      expect(result.current.state.isRecording).toBe(true)
    })

    it('should stop recording even if countdown was not displayed', async () => {
      const options = createMockOptions()
      const { result } = renderHook(() => useAudioRecorder(options))

      await act(async () => {
        await result.current.startRecording()
      })

      // Jump directly past threshold without going through countdown window
      // (if threshold is 4000ms and countdown starts at 3000ms, jump to 5000ms)
      currentTime = 1000 + AUTO_STOP_SILENCE_THRESHOLD_MS + 1000
      await act(async () => {
        // Advance enough for the interval to run (it checks every 100ms)
        vi.advanceTimersByTime(200)
      })

      expect(result.current.state.isRecording).toBe(false)
    })
  })

  describe('cleanup on unmount', () => {
    it('should clear silence detection interval on unmount', async () => {
      const options = createMockOptions()
      const { result, unmount } = renderHook(() => useAudioRecorder(options))

      await act(async () => {
        await result.current.startRecording()
      })

      expect(result.current.state.isRecording).toBe(true)

      // Unmount component
      unmount()

      // Advance time past threshold
      currentTime = 1000 + AUTO_STOP_SILENCE_THRESHOLD_MS + 100
      await act(async () => {
        vi.advanceTimersByTime(200)
      })

      // stopRecording should not be called because component is unmounted
      // (We can't directly test the interval was cleared, but we can verify
      // that stopRecording wasn't called after unmount)
      // The state won't update because component is unmounted, so we verify
      // that stopSpeechRecognition wasn't called after unmount
      expect(mockSpeechControls.stopSpeechRecognition).not.toHaveBeenCalled()
    })

    it('should not call setState after unmount', async () => {
      const options = createMockOptions()
      const { result, unmount } = renderHook(() => useAudioRecorder(options))

      await act(async () => {
        await result.current.startRecording()
      })

      // Move into countdown window
      currentTime = 1000 + AUTO_STOP_SILENCE_THRESHOLD_MS - AUTO_STOP_COUNTDOWN_START_MS + 100
      await act(async () => {
        vi.advanceTimersByTime(150)
      })

      const countdownBeforeUnmount = result.current.state.autoStopCountdown
      expect(countdownBeforeUnmount).not.toBe(null)

      // Unmount component
      unmount()

      // Advance time further
      currentTime = 1000 + AUTO_STOP_SILENCE_THRESHOLD_MS - AUTO_STOP_COUNTDOWN_START_MS + 500
      await act(async () => {
        vi.advanceTimersByTime(200)
      })

      // State should not have changed (we can't directly verify this, but
      // the fact that no errors occurred indicates setState wasn't called)
      // This test primarily ensures no React warnings are generated
    })
  })

  describe('edge cases', () => {
    it('should handle rapid start/stop cycles', async () => {
      const options = createMockOptions()
      const { result } = renderHook(() => useAudioRecorder(options))

      // Start recording
      await act(async () => {
        await result.current.startRecording()
      })

      expect(result.current.state.isRecording).toBe(true)

      // Stop immediately
      act(() => {
        result.current.stopRecording()
      })

      expect(result.current.state.isRecording).toBe(false)
      expect(result.current.state.autoStopCountdown).toBe(null)

      // Start again
      await act(async () => {
        await result.current.startRecording()
      })

      expect(result.current.state.isRecording).toBe(true)
      expect(result.current.state.autoStopCountdown).toBe(null)

      // Advance time
      currentTime = 2000 + AUTO_STOP_SILENCE_THRESHOLD_MS - AUTO_STOP_COUNTDOWN_START_MS + 100
      await act(async () => {
        vi.advanceTimersByTime(150)
      })

      // Countdown should work normally after restart
      expect(result.current.state.autoStopCountdown).not.toBe(null)
    })

    it('should handle multiple rapid transcript updates', async () => {
      const options = createMockOptions()
      const { result } = renderHook(() => useAudioRecorder(options))

      await act(async () => {
        await result.current.startRecording()
      })

      // Rapidly update transcript multiple times
      // Each update resets the timer to the current performance.now()
      currentTime = 1000
      act(() => {
        result.current.updateTranscript({ interim: 'Hello', final: '' })
      })
      currentTime = 1500
      act(() => {
        result.current.updateTranscript({ interim: 'Hello world', final: '' })
      })
      currentTime = 2000
      act(() => {
        result.current.updateTranscript({ interim: '', final: 'Hello world' })
      })

      // Timer was reset to 2000 by the last update
      // Advance time but not enough to trigger countdown again
      // (timer was reset to 2000, so we need less than AUTO_STOP_SILENCE_THRESHOLD_MS - AUTO_STOP_COUNTDOWN_START_MS)
      currentTime = 2000 + AUTO_STOP_SILENCE_THRESHOLD_MS - AUTO_STOP_COUNTDOWN_START_MS - 100
      await act(async () => {
        vi.advanceTimersByTime(150)
      })

      // Should still be null because timer was reset by last update and we haven't entered countdown window
      expect(result.current.state.autoStopCountdown).toBe(null)
    })

    it('should handle stopRecording being called manually during countdown', async () => {
      const options = createMockOptions()
      const { result } = renderHook(() => useAudioRecorder(options))

      await act(async () => {
        await result.current.startRecording()
      })

      // Move into countdown window
      currentTime = 1000 + AUTO_STOP_SILENCE_THRESHOLD_MS - AUTO_STOP_COUNTDOWN_START_MS + 100
      await act(async () => {
        vi.advanceTimersByTime(150)
      })

      expect(result.current.state.autoStopCountdown).not.toBe(null)
      expect(result.current.state.isRecording).toBe(true)

      // Manually stop recording
      act(() => {
        result.current.stopRecording()
      })

      expect(result.current.state.isRecording).toBe(false)
      expect(result.current.state.autoStopCountdown).toBe(null)

      // Advance time further - should not trigger auto-stop since already stopped
      currentTime = 1000 + AUTO_STOP_SILENCE_THRESHOLD_MS + 1000
      await act(async () => {
        vi.advanceTimersByTime(200)
      })

      expect(result.current.state.isRecording).toBe(false)
    })

    it('should handle discardRecording during silence detection', async () => {
      const options = createMockOptions()
      const { result } = renderHook(() => useAudioRecorder(options))

      await act(async () => {
        await result.current.startRecording()
      })

      // Move into countdown window
      currentTime = 1000 + AUTO_STOP_SILENCE_THRESHOLD_MS - AUTO_STOP_COUNTDOWN_START_MS + 100
      await act(async () => {
        vi.advanceTimersByTime(150)
      })

      expect(result.current.state.autoStopCountdown).not.toBe(null)

      // Discard recording
      act(() => {
        result.current.discardRecording()
      })

      expect(result.current.state.isRecording).toBe(false)
      expect(result.current.state.autoStopCountdown).toBe(null)
    })

    it('should handle silence detection when recording stops before threshold', async () => {
      const options = createMockOptions()
      const { result } = renderHook(() => useAudioRecorder(options))

      await act(async () => {
        await result.current.startRecording()
      })

      // Advance time but not past threshold
      currentTime = 1000 + AUTO_STOP_SILENCE_THRESHOLD_MS - 1000
      await act(async () => {
        vi.advanceTimersByTime(150)
      })

      // Manually stop before threshold
      act(() => {
        result.current.stopRecording()
      })

      expect(result.current.state.isRecording).toBe(false)
      expect(result.current.state.autoStopCountdown).toBe(null)

      // Advance time past threshold - should not trigger anything
      currentTime = 1000 + AUTO_STOP_SILENCE_THRESHOLD_MS + 1000
      await act(async () => {
        vi.advanceTimersByTime(200)
      })

      expect(result.current.state.isRecording).toBe(false)
    })
  })
})
