import * as Moonshine from '@moonshine-ai/moonshine-js'
import { useCallback, useEffect, useRef, useState } from 'react'

type TranscriptUpdate = {
  interim: string
  final: string
}

/**
 * Speech recognition status
 * - 'idle': Not started yet
 * - 'loading': Model is being loaded (first time only, ~190MB download)
 * - 'listening': Actively listening and transcribing
 * - 'error': Critical error occurred (permission denied, etc.)
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

    setSpeechStatus('loading')

    try {
      // Create the MicrophoneTranscriber (model is cached by browser after first download)
      // Options: model/tiny (~190MB, fastest), model/base, model/small
      const envModel = import.meta.env.VITE_MOONSHINE_MODEL
      const modelPath =
        typeof envModel === 'string' && envModel.trim() !== '' ? envModel.trim() : 'model/tiny'
      const transcriber = new Moonshine.MicrophoneTranscriber(
        modelPath,
        {
          onTranscriptionCommitted: (text: string) => {
            // Final transcription - speech segment completed
            if (isRecordingRef.current && text.trim()) {
              onTranscriptUpdate({ interim: '', final: text })
            }
          },
          onTranscriptionUpdated: (text: string) => {
            // Interim transcription - speech in progress
            if (isRecordingRef.current) {
              onTranscriptUpdate({ interim: text, final: '' })
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

      setSpeechStatus('listening')
    } catch (err) {
      // Don't update state if unmounted
      if (!isMountedRef.current) return

      transcriberRef.current = null

      // Handle specific error types
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          onError('Microphone access denied. Please allow microphone access.')
        } else if (err.name === 'NotFoundError') {
          onError('No microphone found. Please connect a microphone.')
        } else if (err.message.toLowerCase().includes('permission')) {
          // Fallback: some browsers/MoonshineJS versions may not set error.name
          // but include 'permission' in the message for denied mic access
          onError('Microphone access denied. Please allow microphone access.')
        } else {
          onError(`Speech recognition error: ${err.message}`)
        }
      } else {
        // For non-Error objects, provide a generic error message
        onError('Failed to start speech recognition: Unknown error')
      }

      setSpeechStatus('error')
    }
  }, [isRecordingRef, onTranscriptUpdate, onError])

  const stopSpeechRecognition = useCallback(() => {
    const transcriber = transcriberRef.current
    if (!transcriber) return

    try {
      transcriber.stop()
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
