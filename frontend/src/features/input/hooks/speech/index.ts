/**
 * Speech Recognition Hook
 *
 * Unified speech-to-text with automatic fallback:
 *
 * 1. PRIMARY: Web Speech API (browser native, best accuracy when available)
 * 2. FALLBACK: MoonshineJS (in-browser, offline-capable, for browsers without Web Speech API)
 *
 * The hook automatically falls back to MoonshineJS if Web Speech API is not available.
 * Consumers don't need to know which engine is being used.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { isDev } from '../../utils/env'
import { createMoonshineEngine } from './moonshineEngine'
import type { SpeechEngine, SpeechStatus, TranscriptUpdate } from './types'
import { INITIALIZATION_CANCELLED_ERROR } from './types'
import { createWebSpeechEngine } from './webSpeechEngine'

export type { DownloadProgress } from './moonshineEngine'
export type { SpeechStatus, TranscriptUpdate }

const LOG_PREFIX = '[SpeechRecognition]'

function log(...args: unknown[]) {
  if (isDev()) {
    console.log(LOG_PREFIX, ...args)
  }
}

type UseSpeechRecognitionOptions = {
  /** Ref that tracks whether recording is currently active */
  isRecordingRef: React.MutableRefObject<boolean>
  /** Called when transcript updates (interim or final) */
  onTranscriptUpdate: (update: TranscriptUpdate) => void
  /** Called on critical errors (permission denied, etc.) */
  onError: (message: string) => void
}

/**
 * Hook for managing speech recognition with automatic fallback.
 *
 * Uses Web Speech API as the primary engine (best accuracy when available).
 * Falls back to MoonshineJS for browsers without Web Speech API support (e.g., Firefox).
 */
export function useSpeechRecognition({
  isRecordingRef,
  onTranscriptUpdate,
  onError,
}: UseSpeechRecognitionOptions) {
  const engineRef = useRef<SpeechEngine | null>(null)
  const isMountedRef = useRef(true)
  const isStartingRef = useRef(false) // Guard against concurrent start attempts
  const [speechStatus, setSpeechStatus] = useState<SpeechStatus>('idle')
  const [speechError, setSpeechError] = useState<string | null>(null)
  const [activeEngine, setActiveEngine] = useState<string | null>(null)

  // Track mounted state
  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
      isStartingRef.current = false
      engineRef.current?.stop()
      engineRef.current = null
    }
  }, [])

  // Note: Moonshine preloading is handled at the app level by useMoonshinePreload
  // This hook only manages the speech recognition lifecycle during recording

  // Create engine callbacks that respect recording state and mounted state
  const createCallbacks = useCallback(
    () => ({
      onTranscriptUpdate: (update: TranscriptUpdate) => {
        // Check both recording state and mounted state to prevent updates after unmount
        if (isRecordingRef.current && isMountedRef.current) {
          onTranscriptUpdate(update)
        }
      },
      onStatusChange: (status: SpeechStatus) => {
        if (isMountedRef.current) {
          setSpeechStatus(status)
          // Clear error when status changes to non-error state
          if (status !== 'error') {
            setSpeechError(null)
          }
        }
      },
      onError: (message: string) => {
        if (isMountedRef.current) {
          setSpeechError(message)
          // Also set status to 'error' to ensure the error is displayed.
          // This is defensive: engines should also call onStatusChange('error'),
          // but we set it here too to guarantee errors are always visible.
          setSpeechStatus('error')
          onError(message)
        }
      },
    }),
    [isRecordingRef, onTranscriptUpdate, onError]
  )

  const startSpeechRecognition = useCallback(async (): Promise<void> => {
    // Prevent concurrent start attempts - guard against rapid clicks or retries
    if (engineRef.current || isStartingRef.current) {
      log('Already running or starting, ignoring concurrent start attempt')
      return
    }

    // Mark that we're starting to prevent concurrent attempts
    isStartingRef.current = true

    try {
      const callbacks = createCallbacks()

      // Track errors from both engines for better error reporting
      let webSpeechError: string | null = null

      // Try Web Speech API first (best accuracy when available)
      const webSpeech = createWebSpeechEngine(callbacks)
      if (webSpeech.isSupported()) {
        log('Trying Web Speech API...')
        try {
          engineRef.current = webSpeech
          setActiveEngine(webSpeech.name)
          await webSpeech.start()
          log('Web Speech API started successfully')
          return // Success - finally block will clear isStartingRef
        } catch (err) {
          log('Web Speech API failed:', err)
          webSpeechError = err instanceof Error ? err.message : 'Unknown error'
          // Clean up any partially initialized resources
          try {
            webSpeech.stop()
          } catch (stopErr) {
            log('Error cleaning up Web Speech API:', stopErr)
          }
          engineRef.current = null
          setActiveEngine(null)
          // Fall through to try MoonshineJS
        }
      } else {
        log('Web Speech API not supported')
        webSpeechError = 'Web Speech API not supported'
      }

      // Fallback to MoonshineJS (for browsers without Web Speech API, e.g., Firefox)
      const moonshine = createMoonshineEngine(callbacks)
      if (moonshine.isSupported()) {
        log('Falling back to MoonshineJS...')
        try {
          engineRef.current = moonshine
          setActiveEngine(moonshine.name)
          await moonshine.start()
          log('MoonshineJS started successfully')
          return // Success - finally block will clear isStartingRef
        } catch (err) {
          // Check if stop() was called during start() - if so, don't report error
          const errorMessage = err instanceof Error ? err.message : 'Unknown error'
          const wasIntentionallyStopped = errorMessage === INITIALIZATION_CANCELLED_ERROR

          if (wasIntentionallyStopped) {
            log('MoonshineJS start was interrupted by stop() call')
            // Clean up and return early - user explicitly stopped
            try {
              moonshine.stop()
            } catch (stopErr) {
              log('Error cleaning up MoonshineJS:', stopErr)
            }
            engineRef.current = null
            setActiveEngine(null)
            return // Cancelled - finally block will clear isStartingRef
          }

          log('MoonshineJS failed:', err)
          engineRef.current = null
          setActiveEngine(null)

          // Both engines failed - set error state
          const moonshineError = errorMessage

          // Always log technical details to console for debugging (even in production)
          // This helps with diagnosing user-reported issues without exposing details in UI
          console.error(
            `${LOG_PREFIX} Both speech recognition engines failed:`,
            `\n- Web Speech API: ${webSpeechError}`,
            `\n- MoonshineJS: ${moonshineError}`
          )

          let userErrorMessage: string
          if (isDev()) {
            // In development, include technical details in UI for debugging
            const errorParts = ['Speech recognition failed.']
            if (webSpeechError) {
              errorParts.push(`Web Speech API: ${webSpeechError}`)
            }
            errorParts.push(`MoonshineJS: ${moonshineError}`)
            userErrorMessage = errorParts.join(' ')
          } else {
            // In production, show user-friendly message in UI only
            userErrorMessage = 'Speech recognition failed. Please try again or use text input.'
          }
          setSpeechError(userErrorMessage)
          onError(userErrorMessage)
          setSpeechStatus('error')
          // Error - finally block will clear isStartingRef
        }
      } else {
        log('MoonshineJS not supported (WebAssembly unavailable)')
        engineRef.current = null
        setActiveEngine(null)

        // Both engines unavailable - set error state
        // Always log technical details to console for debugging (even in production)
        console.error(
          `${LOG_PREFIX} No speech recognition engines available:`,
          `\n- Web Speech API: ${webSpeechError}`,
          '\n- MoonshineJS: not supported (WebAssembly unavailable)'
        )

        let userErrorMessage: string
        if (isDev()) {
          // In development, include technical details in UI for debugging
          const errorParts = ['Speech recognition is not available in this browser.']
          if (webSpeechError) {
            errorParts.push(`Web Speech API: ${webSpeechError}`)
          }
          errorParts.push('MoonshineJS: not supported (WebAssembly unavailable)')
          userErrorMessage = errorParts.join(' ')
        } else {
          // In production, show user-friendly message in UI only
          userErrorMessage =
            'Speech recognition is not available in this browser. Please use text input.'
        }
        setSpeechError(userErrorMessage)
        onError(userErrorMessage)
        setSpeechStatus('error')
        // Error - finally block will clear isStartingRef
      }
    } finally {
      // Cleanup: Always clear the starting flag on any exit path (success, error, or cancelled).
      // This ensures retry attempts are always possible after the function completes.
      isStartingRef.current = false
    }
  }, [createCallbacks, onError])

  const stopSpeechRecognition = useCallback(() => {
    log('Stopping', activeEngine)
    isStartingRef.current = false // Clear starting flag if stopping
    engineRef.current?.stop()
    engineRef.current = null
    setActiveEngine(null)
    setSpeechStatus('idle')
    setSpeechError(null)
  }, [activeEngine])

  const resetSpeechStatus = useCallback(() => {
    setSpeechError(null)
    if (engineRef.current?.isListening() && isRecordingRef.current) {
      setSpeechStatus('listening')
    } else {
      setSpeechStatus('idle')
    }
  }, [isRecordingRef])

  return {
    startSpeechRecognition,
    stopSpeechRecognition,
    speechStatus,
    speechError,
    resetSpeechStatus,
    ...(isDev()
      ? {
          /**
           * The name of the currently active engine (MoonshineJS or Web Speech API).
           * @internal For debugging purposes only. Available only in development builds.
           */
          activeEngine,
        }
      : {}),
  }
}
