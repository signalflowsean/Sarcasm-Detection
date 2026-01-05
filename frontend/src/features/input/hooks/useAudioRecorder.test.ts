import { act, renderHook } from '@testing-library/react'
import type { Mock } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTO_STOP_COUNTDOWN_START_MS, AUTO_STOP_SILENCE_THRESHOLD_MS } from './constants'
import { useAudioRecorder, type SpeechStatus } from './useAudioRecorder'

/**
 * Tests for useAudioRecorder hook
 *
 * Focuses on:
 * - Auto-stop countdown display logic
 * - Silence detection timer behavior
 * - speechStatus='loading' pausing the timer
 * - Timer reset on transcript updates
 */

// Type definitions for mocks
type MockWaveformControls = {
  setupWaveform: Mock
  cleanupWaveform: Mock
  invalidatePeaks: Mock
  computePeaksFromBlob: Mock
  resetWaveform: Mock
}

type MockSpeechControls = {
  startSpeechRecognition: Mock
  stopSpeechRecognition: Mock
}

type MockMediaTrack = {
  stop: Mock
  kind: string
  enabled: boolean
}

type MockMediaStream = {
  getTracks: Mock<() => MockMediaTrack[]>
  getAudioTracks: Mock<() => MockMediaTrack[]>
}

type MockMediaRecorder = {
  start: Mock
  stop: Mock
  pause: Mock
  resume: Mock
  ondataavailable: ((event: Event) => void) | null
  onstop: ((event: Event) => void) | null
  onerror: ((event: Event) => void) | null
  state: string
  addEventListener: Mock
  removeEventListener: Mock
}

// Extend global for mockPerformanceNow
declare global {
  // eslint-disable-next-line no-var
  var mockPerformanceNow: (value: number) => void
}

describe('useAudioRecorder', () => {
  // Mock dependencies
  let mockWaveformControls: MockWaveformControls
  let mockSpeechControls: MockSpeechControls

  // Mock MediaRecorder and MediaStream
  let mockMediaStream: MockMediaStream
  let mockMediaRecorder: MockMediaRecorder
  let mockGetUserMedia: Mock

  beforeEach(() => {
    vi.useFakeTimers()

    // Mock waveform controls
    mockWaveformControls = {
      setupWaveform: vi.fn().mockResolvedValue(undefined),
      cleanupWaveform: vi.fn(),
      invalidatePeaks: vi.fn(),
      computePeaksFromBlob: vi.fn(),
      resetWaveform: vi.fn(),
    }

    // Mock sp  eech controls
    mockSpeechControls = {
      startSpeechRecognition: vi.fn().mockResolvedValue(undefined),
      stopSpeechRecognition: vi.fn(),
    }

    // Mock MediaStream
    mockMediaStream = {
      getTracks: vi.fn().mockReturnValue([
        {
          stop: vi.fn(),
          kind: 'audio',
          enabled: true,
        },
      ]),
      getAudioTracks: vi.fn().mockReturnValue([
        {
          stop: vi.fn(),
          kind: 'audio',
          enabled: true,
        },
      ]),
    }

    // Mock MediaRecorder
    mockMediaRecorder = {
      start: vi.fn(),
      stop: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      ondataavailable: null,
      onstop: null,
      onerror: null,
      state: 'inactive',
      addEventListener: vi.fn((event: string, handler: (event: Event) => void) => {
        if (event === 'dataavailable') mockMediaRecorder.ondataavailable = handler
        if (event === 'stop') mockMediaRecorder.onstop = handler
        if (event === 'error') mockMediaRecorder.onerror = handler
      }),
      removeEventListener: vi.fn(),
    }

    // Mock getUserMedia
    mockGetUserMedia = vi.fn().mockResolvedValue(mockMediaStream)
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      value: {
        getUserMedia: mockGetUserMedia,
      },
    })

    // Mock MediaRecorder constructor
    global.MediaRecorder = vi.fn(() => {
      return mockMediaRecorder as unknown as MediaRecorder
    }) as unknown as typeof MediaRecorder

    // Mock MediaRecorder.isTypeSupported
    ;(global.MediaRecorder as typeof MediaRecorder & { isTypeSupported: Mock }).isTypeSupported = vi
      .fn()
      .mockReturnValue(true)

    // Mock URL.createObjectURL and revokeObjectURL
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
    global.URL.revokeObjectURL = vi.fn()

    // Mock performance.now for timer testing
    let mockNow = 0
    vi.spyOn(performance, 'now').mockImplementation(() => mockNow)
    global.mockPerformanceNow = (value: number) => {
      mockNow = value
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('Silence Detection and Auto-Stop', () => {
    it('should initialize with no countdown', () => {
      const { result } = renderHook(() =>
        useAudioRecorder({
          waveformControls: mockWaveformControls,
          speechControls: mockSpeechControls,
          speechStatus: 'idle',
        })
      )

      expect(result.current.state.autoStopCountdown).toBeNull()
    })

    it('should not show countdown when recording starts', async () => {
      const { result } = renderHook(() =>
        useAudioRecorder({
          waveformControls: mockWaveformControls,
          speechControls: mockSpeechControls,
          speechStatus: 'idle',
        })
      )

      await act(async () => {
        await result.current.startRecording()
      })

      expect(result.current.state.autoStopCountdown).toBeNull()
    })

    it('should show countdown when silence reaches countdown threshold', async () => {
      const { result } = renderHook(() =>
        useAudioRecorder({
          waveformControls: mockWaveformControls,
          speechControls: mockSpeechControls,
          speechStatus: 'listening',
        })
      )

      // Start recording
      await act(async () => {
        await result.current.startRecording()
      })

      // Fast forward past the countdown start threshold
      const timeBeforeCountdown = AUTO_STOP_SILENCE_THRESHOLD_MS - AUTO_STOP_COUNTDOWN_START_MS
      global.mockPerformanceNow(timeBeforeCountdown + 500)

      // Advance timers to trigger silence detection check
      act(() => {
        vi.advanceTimersByTime(100)
      })

      // Should now show countdown
      expect(result.current.state.autoStopCountdown).not.toBeNull()
      expect(result.current.state.autoStopCountdown).toBeLessThan(AUTO_STOP_COUNTDOWN_START_MS)
    })

    it('should auto-stop recording after silence threshold', async () => {
      const { result } = renderHook(() =>
        useAudioRecorder({
          waveformControls: mockWaveformControls,
          speechControls: mockSpeechControls,
          speechStatus: 'listening',
        })
      )

      // Start recording
      await act(async () => {
        await result.current.startRecording()
      })

      expect(result.current.state.isRecording).toBe(true)

      // Fast forward past silence threshold
      global.mockPerformanceNow(AUTO_STOP_SILENCE_THRESHOLD_MS + 100)

      // Advance timers to trigger auto-stop
      act(() => {
        vi.advanceTimersByTime(100)
      })

      // Trigger MediaRecorder stop event
      await act(async () => {
        if (mockMediaRecorder.onstop) {
          await mockMediaRecorder.onstop(new Event('stop'))
        }
      })

      // Recording should have stopped
      expect(result.current.state.isRecording).toBe(false)
    })

    it('should reset silence timer on transcript update', async () => {
      const { result } = renderHook(() =>
        useAudioRecorder({
          waveformControls: mockWaveformControls,
          speechControls: mockSpeechControls,
          speechStatus: 'listening',
        })
      )

      // Start recording
      await act(async () => {
        await result.current.startRecording()
      })

      // Fast forward to near countdown start
      const nearCountdown = AUTO_STOP_SILENCE_THRESHOLD_MS - AUTO_STOP_COUNTDOWN_START_MS - 500
      global.mockPerformanceNow(nearCountdown)

      act(() => {
        vi.advanceTimersByTime(100)
      })

      // Update transcript (should reset timer)
      act(() => {
        result.current.updateTranscript({ interim: '', final: 'test' })
      })

      // Verify countdown was cleared
      expect(result.current.state.autoStopCountdown).toBeNull()

      // Fast forward again, but timer should have reset
      global.mockPerformanceNow(nearCountdown + 1000)

      act(() => {
        vi.advanceTimersByTime(100)
      })

      // Should still be recording (timer was reset)
      expect(result.current.state.isRecording).toBe(true)
    })

    it('should clear countdown when speech resumes', async () => {
      const { result } = renderHook(() =>
        useAudioRecorder({
          waveformControls: mockWaveformControls,
          speechControls: mockSpeechControls,
          speechStatus: 'listening',
        })
      )

      // Start recording
      await act(async () => {
        await result.current.startRecording()
      })

      // Fast forward to trigger countdown
      const inCountdown = AUTO_STOP_SILENCE_THRESHOLD_MS - AUTO_STOP_COUNTDOWN_START_MS + 500
      global.mockPerformanceNow(inCountdown)

      act(() => {
        vi.advanceTimersByTime(100)
      })

      // Countdown should be showing
      expect(result.current.state.autoStopCountdown).not.toBeNull()

      // Update transcript (speech resumed)
      act(() => {
        result.current.updateTranscript({ interim: 'speaking', final: '' })
      })

      // Countdown should be cleared
      expect(result.current.state.autoStopCountdown).toBeNull()
    })
  })

  describe('speechStatus Integration', () => {
    it('should pause silence timer when speechStatus is loading', async () => {
      const { result, rerender } = renderHook(
        ({ speechStatus }: { speechStatus: SpeechStatus }) =>
          useAudioRecorder({
            waveformControls: mockWaveformControls,
            speechControls: mockSpeechControls,
            speechStatus,
          }),
        {
          initialProps: { speechStatus: 'idle' as SpeechStatus },
        }
      )

      // Start recording
      await act(async () => {
        await result.current.startRecording()
      })

      // Change to loading status
      rerender({ speechStatus: 'loading' })

      // Fast forward time
      const longTime = AUTO_STOP_SILENCE_THRESHOLD_MS + 1000
      global.mockPerformanceNow(longTime)

      act(() => {
        vi.advanceTimersByTime(100)
      })

      // Should NOT auto-stop because timer is paused during loading
      expect(result.current.state.isRecording).toBe(true)
      expect(result.current.state.autoStopCountdown).toBeNull()
    })

    it('should resume silence timer when speechStatus changes from loading to listening', async () => {
      const { result, rerender } = renderHook(
        ({ speechStatus }: { speechStatus: SpeechStatus }) =>
          useAudioRecorder({
            waveformControls: mockWaveformControls,
            speechControls: mockSpeechControls,
            speechStatus,
          }),
        {
          initialProps: { speechStatus: 'loading' as SpeechStatus },
        }
      )

      // Start recording while loading
      await act(async () => {
        await result.current.startRecording()
      })

      // Fast forward time (should be paused during loading)
      global.mockPerformanceNow(1000)

      act(() => {
        vi.advanceTimersByTime(100)
      })

      // Verify recording is still active (timer paused during loading)
      expect(result.current.state.isRecording).toBe(true)

      // Change to listening (timer should reset and resume)
      let transitionTime = 1000
      act(() => {
        global.mockPerformanceNow(transitionTime)
        rerender({ speechStatus: 'listening' })
        vi.advanceTimersByTime(50) // Process status change effect
      })

      // Now advance time to trigger countdown (from the reset point)
      // Timer was reset when status changed, so we start counting from transitionTime
      transitionTime += AUTO_STOP_SILENCE_THRESHOLD_MS - AUTO_STOP_COUNTDOWN_START_MS + 500
      global.mockPerformanceNow(transitionTime)

      act(() => {
        vi.advanceTimersByTime(150) // Trigger silence detection interval
      })

      // Should now show countdown (timer resumed and counting)
      expect(result.current.state.autoStopCountdown).not.toBeNull()
    })

    it('should clear countdown display when status is loading', async () => {
      const { result, rerender } = renderHook(
        ({ speechStatus }: { speechStatus: SpeechStatus }) =>
          useAudioRecorder({
            waveformControls: mockWaveformControls,
            speechControls: mockSpeechControls,
            speechStatus,
          }),
        {
          initialProps: { speechStatus: 'listening' as SpeechStatus },
        }
      )

      // Start recording
      await act(async () => {
        await result.current.startRecording()
      })

      // Fast forward to trigger countdown
      const inCountdown = AUTO_STOP_SILENCE_THRESHOLD_MS - AUTO_STOP_COUNTDOWN_START_MS + 500
      global.mockPerformanceNow(inCountdown)

      act(() => {
        vi.advanceTimersByTime(100)
      })

      // Countdown should be showing
      expect(result.current.state.autoStopCountdown).not.toBeNull()

      // Change to loading
      rerender({ speechStatus: 'loading' })

      act(() => {
        vi.advanceTimersByTime(100)
      })

      // Countdown should be cleared during loading
      expect(result.current.state.autoStopCountdown).toBeNull()
    })
  })

  describe('Countdown Display Logic', () => {
    it('should not show countdown before countdown threshold', async () => {
      const { result } = renderHook(() =>
        useAudioRecorder({
          waveformControls: mockWaveformControls,
          speechControls: mockSpeechControls,
          speechStatus: 'listening',
        })
      )

      // Start recording
      await act(async () => {
        await result.current.startRecording()
      })

      // Fast forward to just before countdown starts
      const beforeCountdown = AUTO_STOP_SILENCE_THRESHOLD_MS - AUTO_STOP_COUNTDOWN_START_MS - 100
      global.mockPerformanceNow(beforeCountdown)

      act(() => {
        vi.advanceTimersByTime(100)
      })

      // Should not show countdown yet
      expect(result.current.state.autoStopCountdown).toBeNull()
    })

    it('should show decreasing countdown values', async () => {
      const { result } = renderHook(() =>
        useAudioRecorder({
          waveformControls: mockWaveformControls,
          speechControls: mockSpeechControls,
          speechStatus: 'listening',
        })
      )

      // Start recording
      await act(async () => {
        await result.current.startRecording()
      })

      // Fast forward to countdown start
      const countdownStart = AUTO_STOP_SILENCE_THRESHOLD_MS - AUTO_STOP_COUNTDOWN_START_MS
      global.mockPerformanceNow(countdownStart + 100)

      act(() => {
        vi.advanceTimersByTime(100)
      })

      const firstCountdown = result.current.state.autoStopCountdown

      // Fast forward more
      global.mockPerformanceNow(countdownStart + 500)

      act(() => {
        vi.advanceTimersByTime(100)
      })

      const secondCountdown = result.current.state.autoStopCountdown

      // Second countdown should be less than first
      expect(firstCountdown).not.toBeNull()
      expect(secondCountdown).not.toBeNull()
      expect(secondCountdown!).toBeLessThan(firstCountdown!)
    })

    it('should stop showing countdown after recording stops', async () => {
      const { result } = renderHook(() =>
        useAudioRecorder({
          waveformControls: mockWaveformControls,
          speechControls: mockSpeechControls,
          speechStatus: 'listening',
        })
      )

      // Start recording
      await act(async () => {
        await result.current.startRecording()
      })

      // Fast forward to trigger countdown
      const inCountdown = AUTO_STOP_SILENCE_THRESHOLD_MS - AUTO_STOP_COUNTDOWN_START_MS + 500
      global.mockPerformanceNow(inCountdown)

      act(() => {
        vi.advanceTimersByTime(100)
      })

      expect(result.current.state.autoStopCountdown).not.toBeNull()

      // Stop recording
      act(() => {
        result.current.stopRecording()
      })

      await act(async () => {
        if (mockMediaRecorder.onstop) {
          await mockMediaRecorder.onstop(new Event('stop'))
        }
      })

      // Countdown should be cleared
      expect(result.current.state.autoStopCountdown).toBeNull()
    })
  })

  describe('Edge Cases', () => {
    it('should handle rapid transcript updates without breaking timer', async () => {
      const { result } = renderHook(() =>
        useAudioRecorder({
          waveformControls: mockWaveformControls,
          speechControls: mockSpeechControls,
          speechStatus: 'listening',
        })
      )

      // Start recording
      await act(async () => {
        await result.current.startRecording()
      })

      // Rapidly update transcript multiple times
      for (let i = 0; i < 10; i++) {
        act(() => {
          result.current.updateTranscript({ interim: `word${i}`, final: '' })
        })
        global.mockPerformanceNow(i * 100)

        act(() => {
          vi.advanceTimersByTime(100)
        })
      }

      // Should still be recording and no countdown
      expect(result.current.state.isRecording).toBe(true)
      expect(result.current.state.autoStopCountdown).toBeNull()
    })

    it('should handle component unmount during silence detection', async () => {
      const { result, unmount } = renderHook(() =>
        useAudioRecorder({
          waveformControls: mockWaveformControls,
          speechControls: mockSpeechControls,
          speechStatus: 'listening',
        })
      )

      // Start recording
      await act(async () => {
        await result.current.startRecording()
      })

      // Unmount while recording
      unmount()

      // Advance timers (should not throw)
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      // No errors should occur
    })

    it('should handle status transition from loading to error', async () => {
      const { result, rerender } = renderHook(
        ({ speechStatus }: { speechStatus: SpeechStatus }) =>
          useAudioRecorder({
            waveformControls: mockWaveformControls,
            speechControls: mockSpeechControls,
            speechStatus,
          }),
        {
          initialProps: { speechStatus: 'loading' as SpeechStatus },
        }
      )

      // Start recording while loading
      await act(async () => {
        await result.current.startRecording()
      })

      // Change to error status
      rerender({ speechStatus: 'error' })
      global.mockPerformanceNow(1000)

      act(() => {
        vi.advanceTimersByTime(100)
      })

      // Should handle gracefully without crashing
      expect(result.current.state.isRecording).toBe(true)
    })
  })
})
