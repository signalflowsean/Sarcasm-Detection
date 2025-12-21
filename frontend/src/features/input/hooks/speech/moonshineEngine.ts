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
      log('Started, isListening:', transcriber.isListening())

      if (transcriber.isListening()) {
        listening = true
      }
    },

    stop(): void {
      log('Stopping...')
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
