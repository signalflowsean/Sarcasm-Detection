/**
 * MoonshineJS Speech Recognition Engine
 *
 * Primary speech-to-text engine using MoonshineJS.
 * Runs entirely in-browser using WebAssembly.
 *
 * Pros:
 * - Works offline after initial model download
 * - Privacy-friendly (no data sent to servers)
 * - Consistent behavior across browsers
 *
 * Cons:
 * - Large model download (~400MB for base)
 * - Can be flaky on some devices
 * - Requires WebAssembly support
 */

import * as Moonshine from '@moonshine-ai/moonshine-js'
import type { SpeechEngine, SpeechEngineCallbacks } from './types'
import { INITIALIZATION_CANCELLED_ERROR } from './types'

const LOG_PREFIX = '[Moonshine]'

function log(...args: unknown[]) {
  if (import.meta.env.DEV) {
    console.log(LOG_PREFIX, ...args)
  }
}

function logError(...args: unknown[]) {
  if (import.meta.env.DEV) {
    console.error(LOG_PREFIX, ...args)
  }
}

export function createMoonshineEngine(callbacks: SpeechEngineCallbacks): SpeechEngine {
  let transcriber: Moonshine.MicrophoneTranscriber | null = null
  let listening = false
  let wasStopped = false // Track if stop() was called during start()

  const getModelPath = (): string => {
    // In dev mode, check for model override
    if (import.meta.env.MODE === 'development') {
      const override = localStorage.getItem('moonshine_model_override')
      if (override) return override
    }
    // Use env variable or default to base model
    const envModel = import.meta.env.VITE_MOONSHINE_MODEL
    return typeof envModel === 'string' && envModel.trim() ? envModel.trim() : 'model/base'
  }

  return {
    name: 'MoonshineJS',

    isSupported(): boolean {
      // MoonshineJS requires WebAssembly
      return typeof WebAssembly !== 'undefined'
    },

    async start(): Promise<void> {
      if (transcriber) {
        log('Already running, ignoring start()')
        return
      }

      // Reset stop flag at start of each attempt
      wasStopped = false

      const modelPath = getModelPath()
      log('Starting with model:', modelPath)

      transcriber = new Moonshine.MicrophoneTranscriber(
        modelPath,
        {
          onTranscriptionCommitted: (text: string) => {
            log('Final transcript:', text)
            if (listening && text.trim()) {
              callbacks.onTranscriptUpdate({ interim: '', final: text })
            }
          },
          onTranscriptionUpdated: (text: string) => {
            log('Interim transcript:', text)
            if (listening) {
              callbacks.onTranscriptUpdate({ interim: text, final: '' })
            }
          },
          onModelLoadStart: () => {
            log('Model loading...')
            callbacks.onStatusChange('loading')
          },
          onModelLoadComplete: () => {
            log('Model loaded, listening:', transcriber?.isListening())
            if (transcriber?.isListening()) {
              listening = true
              callbacks.onStatusChange('listening')
            }
          },
          onError: (error: Error) => {
            logError('Runtime error:', error)
            callbacks.onError(`Transcription error: ${error.message}`)
            callbacks.onStatusChange('error')
          },
        },
        false // Disable VAD for continuous streaming
      )

      await transcriber.start()

      // Check if stop() was called while awaiting transcriber.start()
      // If so, don't access transcriber properties and throw a specific error
      // to prevent fallback to Web Speech API
      if (wasStopped || !transcriber) {
        log('Start was interrupted by stop() call')
        throw new Error(INITIALIZATION_CANCELLED_ERROR)
      }

      log('Started, isListening:', transcriber.isListening())

      if (transcriber.isListening()) {
        listening = true
      }
    },

    stop(): void {
      log('Stopping...')
      // Mark that stop was called - this prevents accessing transcriber
      // if stop() is called while start() is awaiting transcriber.start()
      wasStopped = true
      if (transcriber) {
        try {
          transcriber.stop()
        } catch {
          // May already be stopped
        }
        transcriber = null
      }
      listening = false
      callbacks.onStatusChange('idle')
    },

    isListening(): boolean {
      return listening && (transcriber?.isListening() ?? false)
    },
  }
}
