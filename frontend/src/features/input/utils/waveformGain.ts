/**
 * Waveform gain calculation utilities.
 *
 * These functions are extracted from useWaveform for testability.
 * They implement browser-adaptive gain normalization to ensure consistent
 * waveform display across Chrome (quiet audio) and Firefox (loud audio).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Constants (re-exported from useWaveform for use in tests)
// ─────────────────────────────────────────────────────────────────────────────

export const DEVIATION_THRESHOLDS = {
  VERY_QUIET: 2,
  QUIET: 5,
  MEDIUM: 15,
} as const

export const MAX_GAIN_BY_LEVEL = {
  VERY_QUIET: 8,
  QUIET: 6,
  MEDIUM: 4,
  LOUD: 2,
} as const

export const GAIN_SMOOTHING = {
  ATTACK: 0.3,
  RELEASE: 0.08,
} as const

export const GAIN_COMPRESSION = {
  VISIBILITY_BOOST: 1.5,
} as const

/**
 * Calculate the maximum allowed gain based on audio deviation.
 *
 * Lower deviation (quiet Chrome audio) allows higher gain.
 * Higher deviation (loud Firefox audio) caps gain lower.
 *
 * @param maxDeviation - Maximum deviation from center (128) in the audio data
 * @returns Maximum allowed gain multiplier
 */
export function calculateMaxAllowedGain(maxDeviation: number): number {
  if (maxDeviation <= DEVIATION_THRESHOLDS.VERY_QUIET) {
    return MAX_GAIN_BY_LEVEL.VERY_QUIET
  }
  if (maxDeviation <= DEVIATION_THRESHOLDS.QUIET) {
    return MAX_GAIN_BY_LEVEL.QUIET
  }
  if (maxDeviation <= DEVIATION_THRESHOLDS.MEDIUM) {
    return MAX_GAIN_BY_LEVEL.MEDIUM
  }
  return MAX_GAIN_BY_LEVEL.LOUD
}

/**
 * Calculate target gain with sqrt compression and visibility boost.
 *
 * Applies sqrt compression to reduce dynamic range, then applies
 * visibility boost to compensate and ensure good canvas fill.
 *
 * @param baseGain - Raw gain needed to reach target amplitude
 * @param maxAllowedGain - Maximum gain cap based on signal level
 * @returns Target gain (clamped between 1.0 and maxAllowedGain)
 */
export function calculateTargetGain(baseGain: number, maxAllowedGain: number): number {
  // Handle edge cases: negative or NaN baseGain
  if (!Number.isFinite(baseGain) || baseGain < 0) {
    return 1.0
  }

  // Apply sqrt compression for perceptual scaling
  const compressedGain = Math.sqrt(baseGain) * GAIN_COMPRESSION.VISIBILITY_BOOST

  // Clamp between 1.0 (minimum) and maxAllowedGain (maximum)
  return Math.max(Math.min(compressedGain, maxAllowedGain), 1.0)
}

/**
 * Apply adaptive smoothing to gain changes.
 *
 * Uses fast attack when gain increases (responsive to speech onset)
 * and slow release when gain decreases (smooth decay).
 *
 * @param currentGain - Current smoothed gain value
 * @param targetGain - Target gain to move towards
 * @returns New smoothed gain value
 */
export function applyGainSmoothing(currentGain: number, targetGain: number): number {
  // Choose smoothing factor: fast attack, slow release
  const smoothingFactor = targetGain > currentGain ? GAIN_SMOOTHING.ATTACK : GAIN_SMOOTHING.RELEASE
  // Apply exponential smoothing
  return currentGain + (targetGain - currentGain) * smoothingFactor
}

/**
 * Calculate maximum deviation from center (128) in audio data.
 *
 * @param audioData - Uint8Array of audio samples (0-255 range)
 * @returns Maximum deviation from center, minimum 1 to avoid division by zero
 */
export function calculateMaxDeviation(audioData: Uint8Array): number {
  let minVal = 255
  let maxVal = 0

  for (let i = 0; i < audioData.length; i++) {
    if (audioData[i] < minVal) minVal = audioData[i]
    if (audioData[i] > maxVal) maxVal = audioData[i]
  }

  // Return max deviation from center (128), minimum 1 to avoid division by zero
  return Math.max(maxVal - 128, 128 - minVal, 1)
}
