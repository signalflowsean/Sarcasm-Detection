/**
 * Web Speech API Speech Recognition Engine
 *
 * Primary speech-to-text engine using the browser's native Web Speech API.
 * Falls back to MoonshineJS when not available (Firefox, Opera, etc.).
 *
 * Pros:
 * - No model download required
 * - Fast startup
 * - Best accuracy (uses cloud services)
 *
 * Cons:
 * - Requires internet connection
 * - Not available in all browsers (Firefox, Opera, some mobile)
 * - May have privacy implications (sends audio to cloud)
 */

import { isDev } from '../../utils/env'
import type { SpeechEngine, SpeechEngineCallbacks } from './types'

const LOG_PREFIX = '[WebSpeech]'

function log(...args: unknown[]) {
  if (isDev()) {
    console.log(LOG_PREFIX, ...args)
  }
}

function logError(...args: unknown[]) {
  if (isDev()) {
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

/**
 * Check if Web Speech API is supported in the current browser.
 * This can be called before creating an engine to determine if preloading
 * Moonshine is needed.
 *
 * Dev override: localStorage.setItem('force_moonshine', 'true') to force
 * Moonshine mode even on browsers with Web Speech API (for testing).
 * To disable: localStorage.removeItem('force_moonshine')
 */
export function isWebSpeechSupported(): boolean {
  // Dev override: force Moonshine mode for testing
  // Only works in dev mode to prevent accidentally shipping with it enabled
  if (
    isDev() &&
    typeof window !== 'undefined' &&
    localStorage.getItem('force_moonshine') === 'true'
  ) {
    // Always warn when override is active, even in dev mode, so developers know it's enabled
    console.warn(
      '%c[WebSpeech] DEVELOPER OVERRIDE ACTIVE',
      'color: orange; font-weight: bold',
      '\n' +
        'Web Speech API detection is being bypassed via localStorage.force_moonshine = "true"\n' +
        'This forces the app to use Moonshine instead of Web Speech API.\n' +
        'To disable: localStorage.removeItem("force_moonshine") or set to "false"\n' +
        'Note: This override only works in development mode.'
    )
    return false
  }

  const SpeechRecognition = getSpeechRecognition()
  if (!SpeechRecognition) return false

  // Light-weight check: verify prototype has expected methods without instantiating
  // This avoids creating objects that might have cleanup concerns
  if (typeof SpeechRecognition.prototype?.start !== 'function') {
    return false
  }

  // Final check: verify constructor doesn't throw
  // Some browsers (Firefox, Edge, Opera) have the constructor but it throws
  // when you try to use it. We must instantiate to detect this.
  try {
    const test = new SpeechRecognition()
    // Explicitly null the reference to aid garbage collection.
    // Note: An unstarted SpeechRecognition has no active resources,
    // so GC is sufficient for cleanup. abort() is unnecessary and may throw.
    void test // Prevent unused variable warning
    return true
  } catch {
    // Constructor threw - API not actually supported
    return false
  }
}

type RecognitionState = 'idle' | 'starting' | 'listening' | 'ending' | 'restarting'

export function createWebSpeechEngine(callbacks: SpeechEngineCallbacks): SpeechEngine {
  let recognition: InstanceType<SpeechRecognitionType> | null = null
  let listening = false
  let shouldRestart = false
  let state: RecognitionState = 'idle' // State machine to prevent issues from interleaved callback execution

  return {
    name: 'Web Speech API',

    isSupported(): boolean {
      // Reuse the standalone function to avoid code duplication
      return isWebSpeechSupported()
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
      // Set 'loading' status to give users feedback while connecting to cloud services.
      // Although Web Speech API doesn't download a model, there's still a brief delay
      // while the browser connects to the cloud recognition service. This is especially
      // noticeable on slower connections.
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
            // Reset listening flag immediately since onend may not fire reliably
            listening = false
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
            // Reset listening flag immediately since onend may not fire reliably for fatal errors
            listening = false
            // Internal state machine state will be handled by onend handler (may auto-restart)
            break
          case 'aborted':
            // User or code stopped it, not an error
            // Internal state machine state will be handled by onend handler
            break
          case 'audio-capture':
            callbacks.onError('Audio capture failed. Your device may not support audio input.')
            callbacks.onStatusChange('error')
            // Reset listening flag immediately since onend may not fire reliably for fatal errors
            listening = false
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
        // to prevent issues if start() is called while this handler is executing
        const currentRecognition = recognition
        const wasListening = state === 'listening' || state === 'restarting'

        // Transition to ending state to prevent interleaved operations
        state = 'ending'

        // Auto-restart if we didn't intentionally stop
        // Web Speech API tends to stop after silence
        if (shouldRestart && currentRecognition && wasListening) {
          // Double-check that this is still the current instance and we're still in ending state
          // (prevents issues if start() or stop() was called during handler execution)
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
            // State changed during execution: recognition instance or state was modified by another code path
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
          // Use abort() for immediate cleanup and microphone release
          // stop() is graceful but may delay cleanup
          currentRecognition.abort()
        } catch {
          // If abort fails, try stop() as fallback
          try {
            currentRecognition.stop()
          } catch {
            // May already be stopped
          }
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
