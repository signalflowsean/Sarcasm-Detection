import { useRef, useCallback } from 'react'
import { isMobileBrowser, isIOSDevice } from '../utils'

// Minimal typings for Web Speech API
type SpeechRecognitionLike = {
  interimResults: boolean
  continuous?: boolean
  maxAlternatives?: number
  lang: string
  onresult: (event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void
  onerror: (event: unknown) => void
  onend: () => void
  start: () => void
  stop: () => void
}

const getSpeechRecognitionCtor = (): (new () => SpeechRecognitionLike) | null => {
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

type TranscriptUpdate = {
  interim: string
  final: string
}

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

  // Track restart attempts for iOS Safari workaround
  const restartAttemptsRef = useRef(0)
  const maxRestartAttempts = 50 // Allow many restarts during a recording session
  const restartDelayRef = useRef<number | null>(null)

  const startSpeechRecognition = useCallback(() => {
    if (!speechSupported) return
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) return

    // Reset restart counter when starting fresh
    restartAttemptsRef.current = 0

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

    recognition.onresult = (event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const res = event.results[i]
        if (res.isFinal) final += res[0].transcript
        else interim += res[0].transcript
      }
      onTranscriptUpdate({ interim, final })
    }

    recognition.onerror = (event: unknown) => {
      const errorEvent = event as { error?: string; message?: string }
      const errorType = errorEvent.error || 'unknown'

      // Only show user-facing errors for critical issues
      if (errorType === 'not-allowed' || errorType === 'service-not-allowed') {
        onError('Microphone permission denied for speech recognition')
      } else if (errorType === 'network') {
        onError('Network error: Speech recognition unavailable')
      } else if (errorType === 'no-speech') {
        // This is common on mobile when recognition times out without detecting speech
        // Don't show error, just log - the onend handler will restart if still recording
        console.warn('Speech recognition: No speech detected')
      } else if (errorType === 'audio-capture') {
        // Audio capture failed - common on mobile when mic access is interrupted
        console.warn('Speech recognition: Audio capture failed')
      } else if (errorType !== 'aborted') {
        // Log other errors but don't show to user (might be transient)
        console.warn('Speech recognition error:', errorType)
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
                console.warn('Failed to restart speech recognition:', e)
              }
            }
          }, delay)
        } else {
          try {
            recognition.start()
          } catch (e) {
            console.warn('Failed to restart speech recognition:', e)
          }
        }
      } else {
        recognitionRef.current = null
      }
    }

    recognitionRef.current = recognition

    // Start immediately to preserve user gesture context (required on some mobile browsers)
    // The delay is only used for REstarting after onend events
    try {
      recognition.start()
    } catch (e) {
      console.warn('Failed to start speech recognition:', e)
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
    } catch { /* noop */ }
    recognitionRef.current = null
  }, [])

  return {
    startSpeechRecognition,
    stopSpeechRecognition,
    speechSupported,
  }
}

