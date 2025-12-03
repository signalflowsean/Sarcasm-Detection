/**
 * ============================================================================
 * CENTRALIZED BREAKPOINT CONFIGURATION
 * ============================================================================
 * 
 * This file is the SINGLE SOURCE OF TRUTH for responsive breakpoints.
 * 
 * ⚠️  IMPORTANT: If you change values here, you MUST also update:
 *     1. frontend/src/index.css - Media queries at:
 *        - Line ~2047: @media (min-width: ${MOBILE_BREAKPOINT}px)  [Desktop styles]
 *        - Line ~2113: @media (max-width: ${MOBILE_BREAKPOINT - 1}px)  [Mobile styles]
 * 
 * Why can't CSS use these values directly?
 * CSS media queries don't support CSS custom properties (variables).
 * This is a CSS spec limitation, not a tooling issue.
 * 
 * ============================================================================
 * BREAKPOINT OVERVIEW
 * ============================================================================
 * 
 * MOBILE_BREAKPOINT (1440px):
 *   - Desktop: min-width: 1440px (side-by-side layout)
 *   - Mobile:  max-width: 1439px (stacked/modal layout)
 *   - Used in: InputContainer.tsx (JS), index.css (CSS media queries)
 * 
 * SMALL_MOBILE_BREAKPOINT (768px):
 *   - Only affects: FirstTimeOverlay styling (smaller text, stacked layout)
 *   - Used in: index.css only (CSS media query)
 * 
 * ============================================================================
 */

// Main mobile/desktop breakpoint - controls layout mode
export const MOBILE_BREAKPOINT = 1440

// Smaller mobile adjustments (first-time overlay only)
export const SMALL_MOBILE_BREAKPOINT = 768

// Pre-built media query strings for useMediaQuery hook
export const MEDIA_QUERIES = {
  /** Matches mobile layout (below breakpoint) */
  isMobile: `(max-width: ${MOBILE_BREAKPOINT - 1}px)`,
  
  /** Matches desktop layout (at or above breakpoint) */
  isDesktop: `(min-width: ${MOBILE_BREAKPOINT}px)`,
  
  /** Matches small mobile screens */
  isSmallMobile: `(max-width: ${SMALL_MOBILE_BREAKPOINT}px)`,
} as const

