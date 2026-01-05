/**
 * Type declarations for @moonshine-ai/moonshine-js
 *
 * MoonshineJS provides on-device speech recognition in the browser.
 * The model (~190MB) is downloaded once and cached.
 */

declare module '@moonshine-ai/moonshine-js' {
  export interface TranscriberCallbacks {
    /** Called when a transcription segment is finalized */
    onTranscriptionCommitted?: (text: string) => void
    /** Called with interim/partial transcription results */
    onTranscriptionUpdated?: (text: string) => void
    /** Called when the model starts loading */
    onModelLoadStart?: () => void
    /** Called when the model finishes loading */
    onModelLoadComplete?: () => void
    /** Called on errors */
    onError?: (error: Error) => void
  }

  /**
   * MicrophoneTranscriber handles microphone input and transcription.
   * It manages its own microphone stream internally.
   */
  export class MicrophoneTranscriber {
    /**
     * Create a new MicrophoneTranscriber
     * @param model - Model identifier (e.g., 'model/tiny', 'model/base')
     * @param callbacks - Callbacks for transcription events
     * @param enableVAD - Whether to enable Voice Activity Detection (default: true)
     */
    constructor(model: string, callbacks?: TranscriberCallbacks, enableVAD?: boolean)

    /** Start listening and transcribing */
    start(): Promise<void>

    /** Stop listening and transcribing */
    stop(): void

    // Note: isListening() method does NOT exist in @moonshine-ai/moonshine-js v0.1.29
    // despite being documented. Track listening state internally instead.
  }

  // Note: FileTranscriber is documented but does NOT exist in @moonshine-ai/moonshine-js v0.1.29
  // If you need file transcription, use MicrophoneTranscriber with audio input
}
