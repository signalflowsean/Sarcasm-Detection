/**
 * Speech Recognition Engine Types
 *
 * Shared types for speech recognition engines.
 * Both MoonshineJS and Web Speech API implementations conform to these types.
 */

export type TranscriptUpdate = {
  interim: string
  final: string
}

export type SpeechStatus = 'idle' | 'loading' | 'listening' | 'error'

export type SpeechEngineCallbacks = {
  onTranscriptUpdate: (update: TranscriptUpdate) => void
  onStatusChange: (status: SpeechStatus) => void
  onError: (message: string) => void
}

/**
 * Speech recognition engine interface.
 * Both Moonshine and Web Speech API engines implement this interface.
 */
export interface SpeechEngine {
  /** Human-readable name for logging */
  readonly name: string

  /** Start listening for speech */
  start(): Promise<void>

  /** Stop listening */
  stop(): void

  /** Check if currently listening */
  isListening(): boolean

  /** Check if this engine is supported in current environment */
  isSupported(): boolean
}

export type SpeechEngineFactory = (callbacks: SpeechEngineCallbacks) => SpeechEngine
