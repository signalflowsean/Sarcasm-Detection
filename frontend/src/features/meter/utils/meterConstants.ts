/**
 * Centralized timing and animation constants for the meter display
 */

// Detection cycle timing
export const RESULT_HOLD_DURATION_MS = 6000

// Needle animation timing
export const NEEDLE_ANIM_DURATION_MS = 700
export const NEEDLE_RETURN_DURATION_MS = 500

// Level indicator animation timing (slower for smoother movement)
export const LEVEL_INDICATOR_ANIM_DURATION_MS = 1400
export const LEVEL_INDICATOR_RETURN_DURATION_MS = 900

// Power-on animation timing
export const POWER_ON_BACKLIGHT_DURATION_MS = 350
export const POWER_ON_STUTTER_DURATION_MS = 700

// Needle rotation range (degrees)
// The needle rotates from -50° (leftmost, value=0) to +50° (rightmost, value=1)
export const NEEDLE_MIN_DEG = -50
export const NEEDLE_MAX_DEG = 50
export const NEEDLE_RANGE_DEG = NEEDLE_MAX_DEG - NEEDLE_MIN_DEG // 100 degrees

// Detection cycle states
export const DetectionState = {
  IDLE: 'IDLE',
  LOADING: 'LOADING',
  HOLDING_RESULT: 'HOLDING_RESULT',
  RESETTING: 'RESETTING',
} as const

export type DetectionStateType = (typeof DetectionState)[keyof typeof DetectionState]
