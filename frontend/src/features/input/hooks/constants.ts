/**
 * Audio Recording Constants
 *
 * Configuration values for audio recording behavior
 */

/**
 * Duration of silence (in ms) before automatically stopping recording.
 * The timer resets whenever new transcript data is received.
 */
export const AUTO_STOP_SILENCE_THRESHOLD_MS = 4000

/**
 * When to start showing the countdown (in ms before auto-stop).
 * For example, 3000ms means the countdown displays during the last 3 seconds.
 */
export const AUTO_STOP_COUNTDOWN_START_MS = 3000

/**
 * Default loading message shown when speech recognition is initializing.
 * Used in Status, SpeechStatus, RecorderContent, and MobileInputControls
 * for generic loading states.
 */
export const SPEECH_LOADING_DEFAULT_MESSAGE = 'Starting speech recognition...'

/**
 * Loading message specifically for Moonshine model download/initialization.
 * Used in MoonshinePreloadStatus when model is being downloaded.
 */
export const MOONSHINE_LOADING_MESSAGE = 'Downloading speech model...'

/**
 * Loading message for Web Speech API connection.
 * Used when connecting to browser's cloud-based speech recognition service.
 */
export const WEB_SPEECH_LOADING_MESSAGE = 'Connecting to speech service...'
