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
        }
      },
      onError: (message: string) => {
        if (isMountedRef.current) {
          onError(message)
        }
      },
    }),
    [isRecordingRef, onTranscriptUpdate, onError]
  )

  const startSpeechRecognition = useCallback(async () => {
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
          isStartingRef.current = false // Success - clear starting flag
          return
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
          isStartingRef.current = false // Success - clear starting flag
          return
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
            isStartingRef.current = false
            return
          }

          log('MoonshineJS failed:', err)
          engineRef.current = null
          setActiveEngine(null)

          // Both engines failed - provide user-friendly message with technical details in dev
          const moonshineError = errorMessage

          if (isDev()) {
            // In development, include technical details for debugging
            const errorParts = ['Speech recognition failed.']
            if (webSpeechError) {
              errorParts.push(`Web Speech API: ${webSpeechError}`)
            }
            errorParts.push(`MoonshineJS: ${moonshineError}`)
            onError(errorParts.join(' '))
          } else {
            // In production, show user-friendly message only
            onError('Speech recognition failed. Please try again or use text input.')
          }
          setSpeechStatus('error')
        }
      } else {
        log('MoonshineJS not supported (WebAssembly unavailable)')
        engineRef.current = null
        setActiveEngine(null)
        // Both engines unavailable - provide user-friendly message with technical details in dev
        if (isDev()) {
          // In development, include technical details for debugging
          const errorParts = ['Speech recognition is not available in this browser.']
          if (webSpeechError) {
            errorParts.push(`Web Speech API: ${webSpeechError}`)
          }
          errorParts.push('MoonshineJS: not supported (WebAssembly unavailable)')
          onError(errorParts.join(' '))
        } else {
          // In production, show user-friendly message only
          onError('Speech recognition is not available in this browser. Please use text input.')
        }
        setSpeechStatus('error')
      }
    } finally {
      // Always clear the starting flag, even if an error occurred
      // This allows retry attempts after failures
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
  }, [activeEngine])

  const resetSpeechStatus = useCallback(() => {
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
