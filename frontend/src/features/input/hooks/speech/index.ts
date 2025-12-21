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
import { createMoonshineEngine } from './moonshineEngine'
import { createWebSpeechEngine } from './webSpeechEngine'
import type { SpeechEngine, SpeechStatus, TranscriptUpdate } from './types'

export type { SpeechStatus, TranscriptUpdate }

const LOG_PREFIX = '[SpeechRecognition]'

function log(...args: unknown[]) {
  if (import.meta.env.DEV) {
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
  const [speechStatus, setSpeechStatus] = useState<SpeechStatus>('idle')
  const [activeEngine, setActiveEngine] = useState<string | null>(null)

  // Track mounted state
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      engineRef.current?.stop()
      engineRef.current = null
    }
  }, [])

  // Create engine callbacks that respect recording state
  const createCallbacks = useCallback(
    () => ({
      onTranscriptUpdate: (update: TranscriptUpdate) => {
        if (isRecordingRef.current) {
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
    if (engineRef.current) {
      log('Already running')
      return
    }

    const callbacks = createCallbacks()

    // Try MoonshineJS first
    const moonshine = createMoonshineEngine(callbacks)
    if (moonshine.isSupported()) {
      log('Trying MoonshineJS...')
      try {
        engineRef.current = moonshine
        setActiveEngine(moonshine.name)
        await moonshine.start()
        log('MoonshineJS started successfully')
        return
      } catch (err) {
        log('MoonshineJS failed:', err)
        engineRef.current = null
        setActiveEngine(null)
        // Fall through to try Web Speech API
      }
    } else {
      log('MoonshineJS not supported (WebAssembly unavailable)')
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
        return
      } catch (err) {
        log('Web Speech API failed:', err)
        engineRef.current = null
        setActiveEngine(null)

        // Both engines failed
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        onError(`Speech recognition unavailable: ${errorMessage}`)
        setSpeechStatus('error')
      }
    } else {
      log('Web Speech API not supported')
      onError('Speech recognition is not available in this browser.')
      setSpeechStatus('error')
    }
  }, [createCallbacks, onError])

  const stopSpeechRecognition = useCallback(() => {
    log('Stopping', activeEngine)
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
    /** The name of the currently active engine (for debugging) */
    activeEngine,
  }
}
