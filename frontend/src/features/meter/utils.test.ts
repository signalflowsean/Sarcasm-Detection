import { describe, it, expect } from 'vitest'
import { normalizeDegrees, circularDistance, angleFromPoints, generateTicks } from './utils'

describe('meter utils', () => {
  describe('normalizeDegrees', () => {
    it('should normalize positive degrees', () => {
      expect(normalizeDegrees(0)).toBe(0)
      expect(normalizeDegrees(90)).toBe(90)
      expect(normalizeDegrees(360)).toBe(0)
      expect(normalizeDegrees(450)).toBe(90)
    })

    it('should normalize negative degrees', () => {
      expect(normalizeDegrees(-90)).toBe(270)
      expect(normalizeDegrees(-180)).toBe(180)
      expect(normalizeDegrees(-360)).toBe(0)
    })
  })

  describe('circularDistance', () => {
    it('should calculate shortest distance between angles', () => {
      expect(circularDistance(0, 90)).toBe(90)
      expect(circularDistance(0, 180)).toBe(180)
      // 350 to 10 should be 20, not 340 (go through 0)
      expect(circularDistance(350, 10)).toBe(20)
    })

    it('should handle same angles', () => {
      expect(circularDistance(45, 45)).toBe(0)
    })
  })

  describe('angleFromPoints', () => {
    it('should calculate angle from center to point', () => {
      // Point directly above center (0°)
      expect(angleFromPoints(0, -1, 0, 0)).toBeCloseTo(0, 5)
      // Point directly to the right (90°)
      expect(angleFromPoints(1, 0, 0, 0)).toBeCloseTo(90, 5)
      // Point directly below (180°)
      expect(angleFromPoints(0, 1, 0, 0)).toBeCloseTo(180, 5)
      // Point directly to the left (270°)
      expect(angleFromPoints(-1, 0, 0, 0)).toBeCloseTo(270, 5)
    })
  })

  describe('generateTicks', () => {
    it('should generate correct number of ticks', () => {
      const ticks = generateTicks({ numberOfTicks: 5 })
      expect(ticks).toHaveLength(5)
    })

    it('should assign correct sizes based on interval', () => {
      const ticks = generateTicks({ numberOfTicks: 5, largeTickInterval: 2 })
      // With interval 2: indices 0, 2, 4 should be LARGE
      expect(ticks[0].size).toBe('large')
      expect(ticks[1].size).toBe('small')
      expect(ticks[2].size).toBe('large')
    })

    it('should generate unique UUIDs', () => {
      const ticks = generateTicks({ numberOfTicks: 3 })
      const uuids = ticks.map(t => t.uuid)
      expect(new Set(uuids).size).toBe(3)
    })
  })
})
