/**
 * Speech Recognition Hook
 *
 * Unified speech-to-text with automatic fallback:
 *
 * 1. PRIMARY: MoonshineJS (in-browser, offline-capable)
 * 2. FALLBACK: Web Speech API (browser native, requires internet)
 *
 * The hook automatically falls back to Web Speech API if MoonshineJS fails.
 * Consumers don't need to know which engine is being used.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { isDev } from '../../utils/env'
import { createMoonshineEngine } from './moonshineEngine'
import type { SpeechEngine, SpeechStatus, TranscriptUpdate } from './types'
import { INITIALIZATION_CANCELLED_ERROR } from './types'
import { createWebSpeechEngine } from './webSpeechEngine'

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
 * Uses MoonshineJS as the primary engine (offline, privacy-friendly).
 * Falls back to Web Speech API if MoonshineJS fails.
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
      let moonshineError: string | null = null

      // Try MoonshineJS first
      const moonshine = createMoonshineEngine(callbacks)
      if (moonshine.isSupported()) {
        log('Trying MoonshineJS...')
        try {
          engineRef.current = moonshine
          setActiveEngine(moonshine.name)
          await moonshine.start()
          log('MoonshineJS started successfully')
          isStartingRef.current = false // Success - clear starting flag
          return
        } catch (err) {
          // Check if stop() was called during start() - if so, don't fallback
          const errorMessage = err instanceof Error ? err.message : 'Unknown error'
          const wasIntentionallyStopped = errorMessage === INITIALIZATION_CANCELLED_ERROR

          if (wasIntentionallyStopped) {
            log(
              'MoonshineJS start was interrupted by stop() call - not falling back to Web Speech API'
            )
            // Clean up and return early - user explicitly stopped
            try {
              moonshine.stop()
            } catch (stopErr) {
              log('Error cleaning up MoonshineJS:', stopErr)
            }
            engineRef.current = null
            setActiveEngine(null)
            isStartingRef.current = false
            return // Don't fall through to Web Speech API
          }

          log('MoonshineJS failed:', err)
          moonshineError = errorMessage
          // Clean up any partially initialized resources
          try {
            moonshine.stop()
          } catch (stopErr) {
            log('Error cleaning up MoonshineJS:', stopErr)
          }
          engineRef.current = null
          setActiveEngine(null)
          // Fall through to try Web Speech API only if it was a real failure
        }
      } else {
        log('MoonshineJS not supported (WebAssembly unavailable)')
        moonshineError = 'MoonshineJS not supported (WebAssembly unavailable)'
      }

      // Fallback to Web Speech API
      const webSpeech = createWebSpeechEngine(callbacks)
      if (webSpeech.isSupported()) {
        log('Falling back to Web Speech API...')
        try {
          engineRef.current = webSpeech
          setActiveEngine(webSpeech.name)
          await webSpeech.start()
          log('Web Speech API started successfully')
          isStartingRef.current = false // Success - clear starting flag
          return
        } catch (err) {
          log('Web Speech API failed:', err)
          engineRef.current = null
          setActiveEngine(null)

          // Both engines failed - provide user-friendly message with technical details in dev
          const webSpeechError = err instanceof Error ? err.message : 'Unknown error'

          if (isDev()) {
            // In development, include technical details for debugging
            const errorParts = ['Speech recognition failed.']
            if (moonshineError) {
              errorParts.push(`MoonshineJS: ${moonshineError}`)
            }
            errorParts.push(`Web Speech API: ${webSpeechError}`)
            onError(errorParts.join(' '))
          } else {
            // In production, show user-friendly message only
            onError('Speech recognition failed. Please try again or use text input.')
          }
          setSpeechStatus('error')
        }
      } else {
        log('Web Speech API not supported')
        engineRef.current = null
        setActiveEngine(null)
        // Both engines unavailable - provide user-friendly message with technical details in dev
        if (isDev()) {
          // In development, include technical details for debugging
          const errorParts = ['Speech recognition is not available in this browser.']
          if (moonshineError) {
            errorParts.push(`MoonshineJS: ${moonshineError}`)
          }
          errorParts.push('Web Speech API: not supported')
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
