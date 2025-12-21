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

type RecognitionState = 'idle' | 'starting' | 'listening' | 'ending' | 'restarting'

export function createWebSpeechEngine(callbacks: SpeechEngineCallbacks): SpeechEngine {
  let recognition: InstanceType<SpeechRecognitionType> | null = null
  let listening = false
  let shouldRestart = false
  let state: RecognitionState = 'idle' // State machine to prevent race conditions

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

      // Prevent concurrent start attempts or starting while already active
      if (state !== 'idle') {
        log('Already running or starting, ignoring start()', { state })
        return
      }

      state = 'starting'
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
        state = 'listening'
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
        logError('Error:', event.error, event.message, 'state:', state)

        // Handle specific errors
        switch (event.error) {
          case 'not-allowed':
            callbacks.onError('Microphone access denied. Please allow microphone access.')
            callbacks.onStatusChange('error')
            shouldRestart = false
            // Reset state - this is a fatal error
            if (recognition) {
              recognition = null
              state = 'idle'
            }
            break
          case 'no-speech':
            // This is normal - just means no speech detected, don't show error
            // Internal state machine state will be handled by onend handler
            log('No speech detected')
            break
          case 'network':
            callbacks.onError('Network error. Web Speech API requires internet.')
            callbacks.onStatusChange('error')
            // Internal state machine state will be handled by onend handler (may auto-restart)
            break
          case 'aborted':
            // User or code stopped it, not an error
            // Internal state machine state will be handled by onend handler
            break
          case 'audio-capture':
            callbacks.onError('Audio capture failed. Your device may not support audio input.')
            callbacks.onStatusChange('error')
            // Internal state machine state will be handled by onend handler
            break
          default:
            callbacks.onError(`Speech recognition error: ${event.error}`)
            callbacks.onStatusChange('error')
          // Internal state machine state will be handled by onend handler
        }
      }

      recognition.onend = () => {
        log('Ended, shouldRestart:', shouldRestart, 'state:', state)
        listening = false

        // Capture the current recognition instance and state atomically
        // to avoid race conditions if start() is called while this handler is executing
        const currentRecognition = recognition
        const wasListening = state === 'listening' || state === 'restarting'

        // Transition to ending state to prevent concurrent operations
        state = 'ending'

        // Auto-restart if we didn't intentionally stop
        // Web Speech API tends to stop after silence
        if (shouldRestart && currentRecognition && wasListening) {
          // Double-check that this is still the current instance and we're still in ending state
          // (prevents race condition if start() or stop() was called during handler execution)
          if (recognition === currentRecognition && state === 'ending') {
            state = 'restarting'
            log('Auto-restarting...')
            try {
              currentRecognition.start()
              // Note: state will transition to 'listening' when onstart fires
            } catch (e) {
              // Notify consumers that restart failed
              const errorMessage = e instanceof Error ? e.message : 'Unknown error'
              logError('Failed to restart:', errorMessage)
              callbacks.onError(`Failed to restart speech recognition: ${errorMessage}`)
              callbacks.onStatusChange('error')
              // Disable auto-restart to prevent infinite retry loops
              shouldRestart = false
              // Reset to idle state to allow recovery
              recognition = null
              state = 'idle'
            }
          } else {
            // Race condition detected: recognition instance changed or state changed
            log('Restart skipped due to state change', {
              recognitionChanged: recognition !== currentRecognition,
              state,
            })
            // If recognition changed, we're already in a new session, so just reset state
            if (recognition !== currentRecognition) {
              state = 'idle'
            }
          }
        } else {
          // No restart needed, transition to idle
          if (recognition === currentRecognition) {
            recognition = null
            state = 'idle'
          }
        }
      }

      recognition.start()
    },

    stop(): void {
      log('Stopping...', { state })
      shouldRestart = false
      const currentRecognition = recognition
      if (currentRecognition) {
        try {
          currentRecognition.stop()
        } catch {
          // May already be stopped
        }
      }
      // Reset state atomically
      recognition = null
      state = 'idle'
      listening = false
      callbacks.onStatusChange('idle')
    },

    isListening(): boolean {
      return listening
    },
  }
}
