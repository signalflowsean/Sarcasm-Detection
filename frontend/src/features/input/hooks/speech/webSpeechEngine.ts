/**
 * Web Speech API Speech Recognition Engine
 *
 * Fallback speech-to-text engine using the browser's native Web Speech API.
 * Used when MoonshineJS fails or isn't available.
 *
 * Pros:
 * - No model download required
 * - Fast startup
 * - Good accuracy (uses cloud services)
 *
 * Cons:
 * - Requires internet connection
 * - Not available in all browsers (Firefox, some mobile)
 * - May have privacy implications (sends audio to cloud)
 */

import type { SpeechEngine, SpeechEngineCallbacks } from './types'

const LOG_PREFIX = '[WebSpeech]'

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

// TypeScript types for Web Speech API (not in all type definitions)
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message?: string
}

type SpeechRecognitionType = new () => {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

function getSpeechRecognition(): SpeechRecognitionType | null {
  // Check for Web Speech API support
  const w = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionType
    webkitSpeechRecognition?: SpeechRecognitionType
  }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

export function createWebSpeechEngine(callbacks: SpeechEngineCallbacks): SpeechEngine {
  let recognition: InstanceType<SpeechRecognitionType> | null = null
  let listening = false
  let shouldRestart = false
  let isStarting = false // Flag to prevent concurrent start attempts

  return {
    name: 'Web Speech API',

    isSupported(): boolean {
      return getSpeechRecognition() !== null
    },

    async start(): Promise<void> {
      const SpeechRecognition = getSpeechRecognition()
      if (!SpeechRecognition) {
        throw new Error('Web Speech API not supported')
      }

      if (recognition || isStarting) {
        log('Already running or starting, ignoring start()')
        return
      }

      isStarting = true
      log('Starting...')
      callbacks.onStatusChange('loading')

      recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'
      shouldRestart = true

      recognition.onstart = () => {
        log('Started listening')
        listening = true
        isStarting = false
        callbacks.onStatusChange('listening')
      }

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = ''
        let final = ''

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          const transcript = result[0].transcript

          if (result.isFinal) {
            final += transcript
            log('Final transcript:', transcript)
          } else {
            interim += transcript
            log('Interim transcript:', transcript)
          }
        }

        if (final) {
          callbacks.onTranscriptUpdate({ interim: '', final })
        } else if (interim) {
          callbacks.onTranscriptUpdate({ interim, final: '' })
        }
      }

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        logError('Error:', event.error, event.message)

        // Handle specific errors
        switch (event.error) {
          case 'not-allowed':
            callbacks.onError('Microphone access denied. Please allow microphone access.')
            callbacks.onStatusChange('error')
            shouldRestart = false
            break
          case 'no-speech':
            // This is normal - just means no speech detected, don't show error
            log('No speech detected')
            break
          case 'network':
            callbacks.onError('Network error. Web Speech API requires internet.')
            callbacks.onStatusChange('error')
            break
          case 'aborted':
            // User or code stopped it, not an error
            break
          case 'audio-capture':
            callbacks.onError('Audio capture failed. Your device may not support audio input.')
            callbacks.onStatusChange('error')
            break
          default:
            callbacks.onError(`Speech recognition error: ${event.error}`)
            callbacks.onStatusChange('error')
        }
      }

      recognition.onend = () => {
        log('Ended, shouldRestart:', shouldRestart)
        listening = false
        isStarting = false

        // Capture the current recognition instance to avoid race conditions
        // if start() is called while this handler is executing
        const currentRecognition = recognition

        // Auto-restart if we didn't intentionally stop
        // Web Speech API tends to stop after silence
        if (shouldRestart && currentRecognition) {
          log('Auto-restarting...')
          try {
            // Only restart if this is still the current recognition instance
            // (prevents race condition if start() was called during handler execution)
            if (recognition === currentRecognition) {
              currentRecognition.start()
            }
          } catch (e) {
            logError('Failed to restart:', e)
            // Notify consumers that restart failed
            const errorMessage =
              e instanceof Error ? e.message : 'Failed to restart speech recognition'
            callbacks.onError(`Failed to restart speech recognition: ${errorMessage}`)
            callbacks.onStatusChange('error')
            // Disable auto-restart to prevent infinite retry loops
            shouldRestart = false
            // Null recognition to allow recovery: start() will create a new instance when recognition is null.
            // This enables recovery from transient errors (consumer can call start() again).
            // Only null if this is still the current instance (prevents race condition)
            if (recognition === currentRecognition) {
              recognition = null
            }
          }
        }
      }

      recognition.start()
    },

    stop(): void {
      log('Stopping...')
      shouldRestart = false
      isStarting = false
      if (recognition) {
        try {
          recognition.stop()
        } catch {
          // May already be stopped
        }
        recognition = null
      }
      listening = false
      callbacks.onStatusChange('idle')
    },

    isListening(): boolean {
      return listening
    },
  }
}
