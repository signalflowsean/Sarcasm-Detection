import { useCallback, useRef, useState } from 'react'
import { isIOSDevice, isMobileBrowser } from '../utils'

// Minimal typings for Web Speech API
type SpeechRecognitionLike = {
  interimResults: boolean
  continuous?: boolean
  maxAlternatives?: number
  lang: string
  onresult: (event: {
    resultIndex: number
    results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>
  }) => void
  onerror: (event: unknown) => void
  onend: () => void
  start: () => void
  stop: () => void
}

const getSpeechRecognitionCtor = (): (new () => SpeechRecognitionLike) | null => {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

type TranscriptUpdate = {
  interim: string
  final: string
}

/**
 * Speech recognition health status
 * - 'idle': Not started yet
 * - 'listening': Actively listening and working
 * - 'degraded': Working but having issues (frequent restarts, no-speech errors)
 * - 'error': Critical error occurred (permission denied, network error)
 * - 'unsupported': Browser doesn't support speech recognition
 */
export type SpeechStatus = 'idle' | 'listening' | 'degraded' | 'error' | 'unsupported'

type UseSpeechRecognitionOptions = {
  /** Ref that tracks whether recording is currently active */
  isRecordingRef: React.MutableRefObject<boolean>
  /** Called when transcript updates (interim or final) */
  onTranscriptUpdate: (update: TranscriptUpdate) => void
  /** Called on critical errors (permission denied, network error) */
  onError: (message: string) => void
}

/**
 * Hook for managing Web Speech API speech recognition during audio recording.
 * Handles browser compatibility, mobile quirks (iOS Safari continuous mode issues),
 * and automatic restart when recognition ends prematurely.
 */
export function useSpeechRecognition({
  isRecordingRef,
  onTranscriptUpdate,
  onError,
}: UseSpeechRecognitionOptions) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const speechSupported = !!getSpeechRecognitionCtor()

  // Speech recognition health status
  const [speechStatus, setSpeechStatus] = useState<SpeechStatus>(
    speechSupported ? 'idle' : 'unsupported'
  )

  // Track restart attempts for iOS Safari workaround
  const restartAttemptsRef = useRef(0)
  const maxRestartAttempts = 50 // Allow many restarts during a recording session
  const restartDelayRef = useRef<number | null>(null)

  // Track health metrics for degraded detection
  const healthMetricsRef = useRef({
    consecutiveNoSpeech: 0,
    consecutiveErrors: 0,
    lastResultTime: 0,
    hasReceivedAnyResult: false,
  })

  // Threshold for considering speech recognition "degraded"
  const DEGRADED_NO_SPEECH_THRESHOLD = 3
  const DEGRADED_ERROR_THRESHOLD = 2

  const startSpeechRecognition = useCallback(() => {
    if (!speechSupported) {
      setSpeechStatus('unsupported')
      return
    }
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      setSpeechStatus('unsupported')
      return
    }

    // Reset restart counter and health metrics when starting fresh
    restartAttemptsRef.current = 0
    healthMetricsRef.current = {
      consecutiveNoSpeech: 0,
      consecutiveErrors: 0,
      lastResultTime: Date.now(),
      hasReceivedAnyResult: false,
    }
    setSpeechStatus('listening')

    const recognition = new Ctor()
    recognition.interimResults = true

    // Mobile browsers (iOS Safari, Chrome on Android, etc.) have issues with continuous mode
    // It often stops after a few seconds. Use non-continuous mode with auto-restart instead.
    const isMobile = isMobileBrowser()
    const isIOS = isIOSDevice()
    recognition.continuous = !isMobile
    recognition.maxAlternatives = 1
    // Use browser's language setting with fallback to en-US
    recognition.lang = navigator.language || 'en-US'

    recognition.onresult = (event: {
      resultIndex: number
      results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>
    }) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const res = event.results[i]
        if (res.isFinal) final += res[0].transcript
        else interim += res[0].transcript
      }
      onTranscriptUpdate({ interim, final })

      // Reset health metrics on successful result
      healthMetricsRef.current.consecutiveNoSpeech = 0
      healthMetricsRef.current.consecutiveErrors = 0
      healthMetricsRef.current.lastResultTime = Date.now()
      healthMetricsRef.current.hasReceivedAnyResult = true

      // If we were degraded but now got a result, we're back to listening
      setSpeechStatus('listening')
    }

    recognition.onerror = (event: unknown) => {
      const errorEvent = event as { error?: string; message?: string }
      const errorType = errorEvent.error || 'unknown'

      // Only show user-facing errors for critical issues
      if (errorType === 'not-allowed' || errorType === 'service-not-allowed') {
        onError('Microphone permission denied for speech recognition')
        setSpeechStatus('error')
      } else if (errorType === 'network') {
        onError('Network error: Speech recognition unavailable')
        setSpeechStatus('error')
      } else if (errorType === 'no-speech') {
        // This is common on mobile when recognition times out without detecting speech
        healthMetricsRef.current.consecutiveNoSpeech += 1
        if (import.meta.env.DEV) {
          console.warn(
            `Speech recognition: No speech detected (${healthMetricsRef.current.consecutiveNoSpeech} consecutive)`
          )
        }

        // Check if we should mark as degraded
        if (healthMetricsRef.current.consecutiveNoSpeech >= DEGRADED_NO_SPEECH_THRESHOLD) {
          setSpeechStatus('degraded')
        }
      } else if (errorType === 'audio-capture') {
        // Audio capture failed - common on mobile when mic access is interrupted
        healthMetricsRef.current.consecutiveErrors += 1
        if (import.meta.env.DEV) {
          console.warn(
            `Speech recognition: Audio capture failed (${healthMetricsRef.current.consecutiveErrors} consecutive)`
          )
        }

        if (healthMetricsRef.current.consecutiveErrors >= DEGRADED_ERROR_THRESHOLD) {
          setSpeechStatus('degraded')
        }
      } else if (errorType !== 'aborted') {
        // Log other errors but don't show to user (might be transient)
        healthMetricsRef.current.consecutiveErrors += 1
        if (import.meta.env.DEV) console.warn('Speech recognition error:', errorType)

        if (healthMetricsRef.current.consecutiveErrors >= DEGRADED_ERROR_THRESHOLD) {
          setSpeechStatus('degraded')
        }
      }
    }

    recognition.onend = () => {
      // Clear any existing restart timeout
      if (restartDelayRef.current != null) {
        clearTimeout(restartDelayRef.current)
        restartDelayRef.current = null
      }

      if (isRecordingRef.current && restartAttemptsRef.current < maxRestartAttempts) {
        restartAttemptsRef.current += 1

        // On mobile browsers, add a delay before restarting to prevent rapid cycling
        // iOS needs longer delay, Android Chrome needs shorter delay
        const delay = isMobile ? (isIOS ? 150 : 100) : 0

        if (delay > 0) {
          restartDelayRef.current = window.setTimeout(() => {
            if (isRecordingRef.current) {
              try {
                recognition.start()
              } catch (e) {
                if (import.meta.env.DEV) console.warn('Failed to restart speech recognition:', e)
                healthMetricsRef.current.consecutiveErrors += 1
                if (healthMetricsRef.current.consecutiveErrors >= DEGRADED_ERROR_THRESHOLD) {
                  setSpeechStatus('degraded')
                }
              }
            }
          }, delay)
        } else {
          try {
            recognition.start()
          } catch (e) {
            if (import.meta.env.DEV) console.warn('Failed to restart speech recognition:', e)
            healthMetricsRef.current.consecutiveErrors += 1
            if (healthMetricsRef.current.consecutiveErrors >= DEGRADED_ERROR_THRESHOLD) {
              setSpeechStatus('degraded')
            }
          }
        }
      } else {
        recognitionRef.current = null
        // If we hit max restarts and never got a result, mark as degraded
        if (!healthMetricsRef.current.hasReceivedAnyResult && isRecordingRef.current) {
          setSpeechStatus('degraded')
        }
      }
    }

    recognitionRef.current = recognition

    // Start immediately to preserve user gesture context (required on some mobile browsers)
    // The delay is only used for REstarting after onend events
    try {
      recognition.start()
    } catch (e) {
      if (import.meta.env.DEV) console.warn('Failed to start speech recognition:', e)
      setSpeechStatus('error')
    }
  }, [speechSupported, isRecordingRef, onTranscriptUpdate, onError])

  const stopSpeechRecognition = useCallback(() => {
    // Clear any pending restart timeout
    if (restartDelayRef.current != null) {
      clearTimeout(restartDelayRef.current)
      restartDelayRef.current = null
    }

    const rec = recognitionRef.current
    if (!rec) return
    try {
      rec.stop()
    } catch {
      /* noop */
    }
    recognitionRef.current = null
    setSpeechStatus(speechSupported ? 'idle' : 'unsupported')
  }, [speechSupported])

  // Reset speech status to idle (useful when dismissing warnings)
  const resetSpeechStatus = useCallback(() => {
    if (speechSupported) {
      setSpeechStatus('idle')
    }
  }, [speechSupported])

  return {
    startSpeechRecognition,
    stopSpeechRecognition,
    speechSupported,
    speechStatus,
    resetSpeechStatus,
  }
}
