import type { Tick } from './types'
import { SMALL, LARGE } from './constants'

export const generateTicks = ({ numberOfTicks = 7, largeTickInterval = 2 }): Tick[] =>
  Array.from({ length: numberOfTicks }, (_, i) => ({
    uuid: crypto.randomUUID(),
    size: i % largeTickInterval === 0 ? LARGE : SMALL,
    rotation: -90 + (i / (numberOfTicks - 1)) * 180,
  }))

export const TICKS: Tick[] = generateTicks({})

// Angle utilities for rotary components
export function normalizeDegrees(deg: number): number {
  return ((deg % 360) + 360) % 360
}

export function circularDistance(a: number, b: number): number {
  const diff = Math.abs(normalizeDegrees(a) - normalizeDegrees(b))
  return Math.min(diff, 360 - diff)
}

// Compute compass-like degrees (0° at top, clockwise positive) from a point
// relative to a given center point.
export function angleFromPoints(x: number, y: number, centerX: number, centerY: number): number {
  return normalizeDegrees((Math.atan2(y - centerY, x - centerX) * 180) / Math.PI + 90)
}
