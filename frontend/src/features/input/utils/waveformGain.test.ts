import { describe, expect, it } from 'vitest'
import {
  applyGainSmoothing,
  calculateMaxAllowedGain,
  calculateMaxDeviation,
  calculateTargetGain,
  DEVIATION_THRESHOLDS,
  GAIN_SMOOTHING,
  MAX_GAIN_BY_LEVEL,
} from './waveformGain'

describe('waveformGain utilities', () => {
  describe('calculateMaxAllowedGain', () => {
    it('should return VERY_QUIET gain for deviation <= 2 (noise/very quiet Chrome)', () => {
      expect(calculateMaxAllowedGain(0)).toBe(MAX_GAIN_BY_LEVEL.VERY_QUIET) // 8
      expect(calculateMaxAllowedGain(1)).toBe(MAX_GAIN_BY_LEVEL.VERY_QUIET) // 8
      expect(calculateMaxAllowedGain(2)).toBe(MAX_GAIN_BY_LEVEL.VERY_QUIET) // 8
    })

    it('should return QUIET gain for deviation > 2 and <= 5 (typical Chrome speech)', () => {
      expect(calculateMaxAllowedGain(2.1)).toBe(MAX_GAIN_BY_LEVEL.QUIET) // 6
      expect(calculateMaxAllowedGain(3)).toBe(MAX_GAIN_BY_LEVEL.QUIET) // 6
      expect(calculateMaxAllowedGain(5)).toBe(MAX_GAIN_BY_LEVEL.QUIET) // 6
    })

    it('should return MEDIUM gain for deviation > 5 and <= 15 (loud Chrome/quiet Firefox)', () => {
      expect(calculateMaxAllowedGain(5.1)).toBe(MAX_GAIN_BY_LEVEL.MEDIUM) // 4
      expect(calculateMaxAllowedGain(10)).toBe(MAX_GAIN_BY_LEVEL.MEDIUM) // 4
      expect(calculateMaxAllowedGain(15)).toBe(MAX_GAIN_BY_LEVEL.MEDIUM) // 4
    })

    it('should return LOUD gain for deviation > 15 (typical Firefox speech)', () => {
      expect(calculateMaxAllowedGain(15.1)).toBe(MAX_GAIN_BY_LEVEL.LOUD) // 2
      expect(calculateMaxAllowedGain(20)).toBe(MAX_GAIN_BY_LEVEL.LOUD) // 2
      expect(calculateMaxAllowedGain(50)).toBe(MAX_GAIN_BY_LEVEL.LOUD) // 2
      expect(calculateMaxAllowedGain(100)).toBe(MAX_GAIN_BY_LEVEL.LOUD) // 2
    })

    it('should handle boundary conditions correctly', () => {
      // Test exact threshold values
      expect(calculateMaxAllowedGain(DEVIATION_THRESHOLDS.VERY_QUIET)).toBe(
        MAX_GAIN_BY_LEVEL.VERY_QUIET
      )
      expect(calculateMaxAllowedGain(DEVIATION_THRESHOLDS.QUIET)).toBe(MAX_GAIN_BY_LEVEL.QUIET)
      expect(calculateMaxAllowedGain(DEVIATION_THRESHOLDS.MEDIUM)).toBe(MAX_GAIN_BY_LEVEL.MEDIUM)
    })
  })

  describe('calculateTargetGain', () => {
    it('should apply sqrt compression and visibility boost', () => {
      // baseGain = 4 → sqrt(4) * 1.5 = 2 * 1.5 = 3.0
      expect(calculateTargetGain(4, 10)).toBeCloseTo(3.0, 5)

      // baseGain = 16 → sqrt(16) * 1.5 = 4 * 1.5 = 6.0
      expect(calculateTargetGain(16, 10)).toBeCloseTo(6.0, 5)

      // baseGain = 1 → sqrt(1) * 1.5 = 1 * 1.5 = 1.5
      expect(calculateTargetGain(1, 10)).toBeCloseTo(1.5, 5)
    })

    it('should clamp gain to maxAllowedGain when compressed gain exceeds it', () => {
      // baseGain = 100 → sqrt(100) * 1.5 = 10 * 1.5 = 15, but max is 8
      expect(calculateTargetGain(100, 8)).toBe(8)

      // baseGain = 64 → sqrt(64) * 1.5 = 8 * 1.5 = 12, but max is 6
      expect(calculateTargetGain(64, 6)).toBe(6)
    })

    it('should enforce minimum gain of 1.0', () => {
      // Very small baseGain should still return at least 1.0
      expect(calculateTargetGain(0.1, 10)).toBe(1.0)
      expect(calculateTargetGain(0.4, 10)).toBe(1.0) // sqrt(0.4) * 1.5 ≈ 0.95
      expect(calculateTargetGain(0, 10)).toBe(1.0)
    })

    it('should handle realistic Chrome-like scenarios', () => {
      // Chrome quiet speech: deviation ~5, canvas height 100
      // TARGET_PEAK_DEVIATION = 100 * 0.2 = 20
      // baseGain = 20 / 5 = 4
      // compressed = sqrt(4) * 1.5 = 3.0
      // maxAllowed for deviation 5 = 6
      expect(calculateTargetGain(4, 6)).toBeCloseTo(3.0, 5)
    })

    it('should handle realistic Firefox-like scenarios', () => {
      // Firefox loud speech: deviation ~40, canvas height 100
      // TARGET_PEAK_DEVIATION = 100 * 0.2 = 20
      // baseGain = 20 / 40 = 0.5
      // compressed = sqrt(0.5) * 1.5 ≈ 1.06
      // maxAllowed for deviation 40 = 2
      const result = calculateTargetGain(0.5, 2)
      expect(result).toBeGreaterThanOrEqual(1.0)
      expect(result).toBeLessThanOrEqual(2.0)
    })
  })

  describe('applyGainSmoothing', () => {
    it('should use fast attack (0.3) when target gain increases', () => {
      const currentGain = 2.0
      const targetGain = 4.0
      const result = applyGainSmoothing(currentGain, targetGain)
      // Expected: 2.0 + (4.0 - 2.0) * 0.3 = 2.0 + 0.6 = 2.6
      expect(result).toBeCloseTo(2.6, 5)
    })

    it('should use slow release (0.08) when target gain decreases', () => {
      const currentGain = 4.0
      const targetGain = 2.0
      const result = applyGainSmoothing(currentGain, targetGain)
      // Expected: 4.0 + (2.0 - 4.0) * 0.08 = 4.0 - 0.16 = 3.84
      expect(result).toBeCloseTo(3.84, 5)
    })

    it('should not change gain when current equals target', () => {
      const currentGain = 3.0
      const targetGain = 3.0
      const result = applyGainSmoothing(currentGain, targetGain)
      expect(result).toBeCloseTo(3.0, 5)
    })

    it('should converge towards target over multiple iterations', () => {
      let currentGain = 1.0
      const targetGain = 5.0

      // Simulate several frames of attack smoothing
      for (let i = 0; i < 10; i++) {
        currentGain = applyGainSmoothing(currentGain, targetGain)
      }

      // Should be much closer to target after 10 iterations
      expect(currentGain).toBeGreaterThan(4.0)
      expect(currentGain).toBeLessThan(5.0)
    })

    it('should demonstrate asymmetric behavior (attack vs release)', () => {
      // Attack: 1.0 → 2.0
      const attackResult = applyGainSmoothing(1.0, 2.0)
      const attackChange = attackResult - 1.0

      // Release: 2.0 → 1.0
      const releaseResult = applyGainSmoothing(2.0, 1.0)
      const releaseChange = Math.abs(releaseResult - 2.0)

      // Attack should change more than release (0.3 vs 0.08)
      expect(attackChange).toBeGreaterThan(releaseChange)
      expect(attackChange / releaseChange).toBeCloseTo(
        GAIN_SMOOTHING.ATTACK / GAIN_SMOOTHING.RELEASE,
        1
      )
    })
  })

  describe('calculateMaxDeviation', () => {
    it('should calculate deviation for centered audio (128)', () => {
      const audioData = new Uint8Array([128, 128, 128, 128])
      // All at center → deviation = 0, but clamped to minimum 1
      expect(calculateMaxDeviation(audioData)).toBe(1)
    })

    it('should calculate deviation for quiet Chrome-like audio', () => {
      // Chrome quiet speech: small deviations around 128
      const audioData = new Uint8Array([126, 127, 128, 129, 130])
      // Max deviation: max(130 - 128, 128 - 126) = max(2, 2) = 2
      expect(calculateMaxDeviation(audioData)).toBe(2)
    })

    it('should calculate deviation for loud Firefox-like audio', () => {
      // Firefox loud speech: large deviations
      const audioData = new Uint8Array([80, 90, 128, 170, 180])
      // Max deviation: max(180 - 128, 128 - 80) = max(52, 48) = 52
      expect(calculateMaxDeviation(audioData)).toBe(52)
    })

    it('should handle audio with peaks only above center', () => {
      const audioData = new Uint8Array([128, 140, 150, 160])
      // Max deviation: max(160 - 128, 128 - 128) = 32
      expect(calculateMaxDeviation(audioData)).toBe(32)
    })

    it('should handle audio with peaks only below center', () => {
      const audioData = new Uint8Array([100, 110, 120, 128])
      // Max deviation: max(128 - 128, 128 - 100) = 28
      expect(calculateMaxDeviation(audioData)).toBe(28)
    })

    it('should handle extreme values', () => {
      const audioData = new Uint8Array([0, 128, 255])
      // Max deviation: max(255 - 128, 128 - 0) = max(127, 128) = 128
      expect(calculateMaxDeviation(audioData)).toBe(128)
    })

    it('should return minimum 1 for silent audio', () => {
      const audioData = new Uint8Array([128])
      expect(calculateMaxDeviation(audioData)).toBe(1)
    })
  })

  describe('integration: full gain calculation pipeline', () => {
    it('should produce appropriate gain for Chrome-like quiet speech', () => {
      // Simulate Chrome quiet speech scenario
      const audioData = new Uint8Array([126, 127, 128, 129, 130, 131, 132])
      const canvasHeight = 100

      // Step 1: Calculate deviation
      const maxDeviation = calculateMaxDeviation(audioData)
      expect(maxDeviation).toBe(4) // max(132 - 128, 128 - 126) = 4

      // Step 2: Calculate base gain
      const targetPeakDeviation = canvasHeight * 0.2 // 20
      const baseGain = targetPeakDeviation / maxDeviation // 20 / 4 = 5

      // Step 3: Get max allowed gain
      const maxAllowedGain = calculateMaxAllowedGain(maxDeviation)
      expect(maxAllowedGain).toBe(6) // deviation 4 → QUIET level

      // Step 4: Calculate target gain
      const targetGain = calculateTargetGain(baseGain, maxAllowedGain)
      // sqrt(5) * 1.5 ≈ 3.35
      expect(targetGain).toBeCloseTo(3.35, 1)
      expect(targetGain).toBeGreaterThan(1.0)
      expect(targetGain).toBeLessThanOrEqual(maxAllowedGain)
    })

    it('should produce appropriate gain for Firefox-like loud speech', () => {
      // Simulate Firefox loud speech scenario
      const audioData = new Uint8Array([80, 90, 100, 128, 150, 170, 180])
      const canvasHeight = 100

      // Step 1: Calculate deviation
      const maxDeviation = calculateMaxDeviation(audioData)
      expect(maxDeviation).toBe(52) // max(180 - 128, 128 - 80) = 52

      // Step 2: Calculate base gain
      const targetPeakDeviation = canvasHeight * 0.2 // 20
      const baseGain = targetPeakDeviation / maxDeviation // 20 / 52 ≈ 0.38

      // Step 3: Get max allowed gain
      const maxAllowedGain = calculateMaxAllowedGain(maxDeviation)
      expect(maxAllowedGain).toBe(2) // deviation 52 → LOUD level

      // Step 4: Calculate target gain
      const targetGain = calculateTargetGain(baseGain, maxAllowedGain)
      // sqrt(0.38) * 1.5 ≈ 0.93, clamped to 1.0
      expect(targetGain).toBe(1.0)
    })

    it('should demonstrate smoothing convergence over time', () => {
      // Start with low gain, target high gain (speech onset)
      let currentGain = 1.0
      const targetGain = 4.0

      // Simulate 20 frames (~333ms at 60fps)
      for (let i = 0; i < 20; i++) {
        currentGain = applyGainSmoothing(currentGain, targetGain)
      }

      // Should be very close to target by now
      expect(currentGain).toBeGreaterThan(3.9)
      expect(currentGain).toBeLessThanOrEqual(4.0)
    })
  })

  describe('edge cases and error conditions', () => {
    it('should handle very large baseGain values', () => {
      const result = calculateTargetGain(10000, 8)
      expect(result).toBe(8) // Should be clamped to maxAllowedGain
      expect(Number.isFinite(result)).toBe(true)
    })

    it('should handle negative gain values gracefully', () => {
      // Negative gains shouldn't occur, but test defensive behavior
      const result = calculateTargetGain(-1, 8)
      expect(result).toBe(1.0) // Should clamp to minimum
      expect(Number.isFinite(result)).toBe(true)
    })

    it('should handle zero maxDeviation (defensive)', () => {
      // calculateMaxDeviation returns minimum 1, but test direct call
      const audioData = new Uint8Array([])
      const result = calculateMaxDeviation(audioData)
      expect(result).toBe(1) // Should return minimum
    })

    it('should handle empty audio data', () => {
      const audioData = new Uint8Array(0)
      const result = calculateMaxDeviation(audioData)
      expect(result).toBe(1) // Should not crash, return minimum
    })
  })
})
