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
