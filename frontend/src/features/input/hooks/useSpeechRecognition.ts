import * as Moonshine from '@moonshine-ai/moonshine-js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getNetworkSpeedEstimate, trackModelPerformance } from '../utils/telemetry'

type TranscriptUpdate = {
  interim: string
  final: string
}

/**
 * Speech recognition status
 * - 'idle': Not started yet
 * - 'loading': Model is being loaded (triggered by onModelLoadStart callback)
 * - 'listening': Actively listening and transcribing (triggered by onModelLoadComplete)
 * - 'error': Critical error occurred (permission denied, startup errors, or runtime errors)
 */
export type SpeechStatus = 'idle' | 'loading' | 'listening' | 'error'

type UseSpeechRecognitionOptions = {
  /** Ref that tracks whether recording is currently active */
  isRecordingRef: React.MutableRefObject<boolean>
  /** Called when transcript updates (interim or final) */
  onTranscriptUpdate: (update: TranscriptUpdate) => void
  /** Called on critical errors (permission denied, etc.) */
  onError: (message: string) => void
}

/**
 * Hook for managing speech recognition using MoonshineJS.
 * Provides reliable cross-browser speech-to-text using an on-device model.
 * The ~190MB model is downloaded once and cached by the browser.
 */
export function useSpeechRecognition({
  isRecordingRef,
  onTranscriptUpdate,
  onError,
}: UseSpeechRecognitionOptions) {
  const transcriberRef = useRef<Moonshine.MicrophoneTranscriber | null>(null)
  const isMountedRef = useRef(true)
  const [speechStatus, setSpeechStatus] = useState<SpeechStatus>('idle')

  // Telemetry tracking refs (dev mode only)
  const modelLoadStartTime = useRef<number>(0)
  const currentModelName = useRef<string>('')
  const transcriptAccumulator = useRef<string>('')

  // Track mounted state for cleanup during async operations
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      // Cleanup any running transcriber on unmount
      if (transcriberRef.current) {
        try {
          transcriberRef.current.stop()
        } catch {
          /* noop */
        }
        transcriberRef.current = null
      }
    }
  }, [])

  const startSpeechRecognition = useCallback(async () => {
    // Don't start if already running
    if (transcriberRef.current) {
      return
    }

    try {
      // Create the MicrophoneTranscriber (model is cached by browser after first download)
      // Options: model/tiny (~190MB, fastest), model/base (~400MB, accurate), model/small (~300MB, balanced)
      // In dev mode, check localStorage for model override from ModelSelector
      const devOverride =
        import.meta.env.MODE === 'development'
          ? localStorage.getItem('moonshine_model_override')
          : null
      const envModel = import.meta.env.VITE_MOONSHINE_MODEL
      const modelPath =
        devOverride ||
        (typeof envModel === 'string' && envModel.trim() !== '' ? envModel.trim() : 'model/base')

      // Store model name for telemetry
      currentModelName.current = modelPath

      const transcriber = new Moonshine.MicrophoneTranscriber(
        modelPath,
        {
          onTranscriptionCommitted: (text: string) => {
            // Final transcription - speech segment completed
            if (isRecordingRef.current && text.trim()) {
              onTranscriptUpdate({ interim: '', final: text })
              // Accumulate transcript for telemetry
              transcriptAccumulator.current += text + ' '
            }
          },
          onTranscriptionUpdated: (text: string) => {
            // Interim transcription - speech in progress
            if (isRecordingRef.current) {
              onTranscriptUpdate({ interim: text, final: '' })
            }
          },
          onModelLoadStart: () => {
            // Model loading has actually started (more accurate than setting loading immediately)
            // Record start time for telemetry
            modelLoadStartTime.current = performance.now()

            if (isMountedRef.current) {
              setSpeechStatus('loading')
            }
          },
          onModelLoadComplete: () => {
            // Model loading finished - ready to listen
            if (isMountedRef.current && transcriberRef.current?.isListening()) {
              setSpeechStatus('listening')

              // Track model load performance (dev mode only)
              const loadTimeMs = performance.now() - modelLoadStartTime.current
              const cacheHit = loadTimeMs < 1000 // If load was under 1s, likely from cache

              trackModelPerformance({
                modelName: currentModelName.current,
                loadTimeMs,
                cacheHit,
                networkSpeedEstimate: getNetworkSpeedEstimate(),
                transcriptLength: 0, // Will be updated when transcription completes
                timestamp: Date.now(),
                success: true,
              })
            }
          },
          onError: (error: Error) => {
            // Runtime transcription errors (different from startup errors)
            if (isMountedRef.current) {
              if (import.meta.env.DEV) {
                console.error('MoonshineJS runtime error:', error)
              }
              onError(`Transcription error: ${error.message}`)
              setSpeechStatus('error')

              // Track error in telemetry (dev mode only)
              trackModelPerformance({
                modelName: currentModelName.current,
                loadTimeMs: 0,
                cacheHit: false,
                transcriptLength: transcriptAccumulator.current.length,
                timestamp: Date.now(),
                success: false,
                errorMessage: error.message,
              })
            }
          },
        },
        // Disable VAD (Voice Activity Detection) for continuous streaming.
        // This ensures immediate, responsive transcription without delays detecting
        // speech start. Appropriate for press-to-record UX with short recordings.
        // For always-on listening, consider enabling VAD for battery efficiency.
        false
      )

      transcriberRef.current = transcriber

      // Start the transcriber - this will request microphone permission
      await transcriber.start()

      // Check if component unmounted during async start
      if (!isMountedRef.current) {
        transcriber.stop()
        return
      }

      // Note: Status transitions are now handled by MoonshineJS callbacks
      // onModelLoadStart, onModelLoadComplete, and onError
    } catch (err) {
      // Don't update state if unmounted
      if (!isMountedRef.current) return

      transcriberRef.current = null

      // Handle specific error types
      let errorMessage = 'Unknown error'
      if (err instanceof Error) {
        errorMessage = err.message
        if (err.name === 'NotAllowedError') {
          onError('Microphone access denied. Please allow microphone access.')
        } else if (err.name === 'NotFoundError') {
          onError('No microphone found. Please connect a microphone or check your device settings.')
        } else if (err.message.toLowerCase().includes('permission')) {
          // Fallback: some browsers/MoonshineJS versions may not set error.name
          // but include 'permission' in the message for denied mic access
          onError('Microphone access denied. Please allow microphone access.')
        } else {
          onError('An unexpected error occurred during speech recognition. Please try again.')
        }
      } else {
        // For non-Error objects, provide a generic error message
        onError('Failed to start speech recognition: Unknown error')
      }

      // Track startup error in telemetry (dev mode only)
      trackModelPerformance({
        modelName: currentModelName.current || 'unknown',
        loadTimeMs: 0,
        cacheHit: false,
        transcriptLength: 0,
        timestamp: Date.now(),
        success: false,
        errorMessage,
      })

      setSpeechStatus('error')
    }
  }, [isRecordingRef, onTranscriptUpdate, onError])

  const stopSpeechRecognition = useCallback(() => {
    const transcriber = transcriberRef.current
    if (!transcriber) return

    try {
      transcriber.stop()

      // Track final transcription metrics if we have accumulated text (dev mode only)
      if (transcriptAccumulator.current.trim()) {
        trackModelPerformance({
          modelName: currentModelName.current,
          loadTimeMs: 0, // Already tracked during load
          cacheHit: true, // Model was already loaded
          transcriptLength: transcriptAccumulator.current.trim().length,
          timestamp: Date.now(),
          success: true,
        })
      }

      // Reset transcript accumulator for next recording
      transcriptAccumulator.current = ''
    } catch {
      /* noop - may already be stopped */
    }

    transcriberRef.current = null
    setSpeechStatus('idle')
  }, [])

  // Reset speech status (useful when dismissing error warnings)
  // Only sets to 'listening' if transcriber is actually running
  const resetSpeechStatus = useCallback(() => {
    if (transcriberRef.current && isRecordingRef.current) {
      setSpeechStatus('listening')
    } else {
      setSpeechStatus('idle')
    }
  }, [isRecordingRef])

  return {
    startSpeechRecognition,
    stopSpeechRecognition,
    speechStatus,
    resetSpeechStatus,
  }
}
