/**
 * Centralized timing and animation constants for the meter display
 */

// API / Mock timing
export const MOCK_RESPONSE_DELAY_MS = 2000;

// Detection cycle timing
export const RESULT_HOLD_DURATION_MS = 6000;

// Needle animation timing
export const NEEDLE_ANIM_DURATION_MS = 700;
export const NEEDLE_RETURN_DURATION_MS = 500;

// Level indicator animation timing (slower for smoother movement)
export const LEVEL_INDICATOR_ANIM_DURATION_MS = 1400;
export const LEVEL_INDICATOR_RETURN_DURATION_MS = 900;

// Power-on animation timing
export const POWER_ON_BACKLIGHT_DURATION_MS = 350;
export const POWER_ON_STUTTER_DURATION_MS = 700;

// Needle rotation range (degrees)
// The needle rotates from -55° (leftmost, value=0) to +55° (rightmost, value=1)
export const NEEDLE_MIN_DEG = -55;
export const NEEDLE_MAX_DEG = 55;
export const NEEDLE_RANGE_DEG = NEEDLE_MAX_DEG - NEEDLE_MIN_DEG; // 110 degrees

// Detection cycle states
export const DetectionState = {
  IDLE: 'IDLE',
  LOADING: 'LOADING',
  HOLDING_RESULT: 'HOLDING_RESULT',
  RESETTING: 'RESETTING',
} as const;

export type DetectionStateType = typeof DetectionState[keyof typeof DetectionState];

