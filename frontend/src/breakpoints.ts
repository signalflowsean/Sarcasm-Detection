/**
 * ============================================================================
 * CENTRALIZED BREAKPOINT CONFIGURATION
 * ============================================================================
 *
 * This file is the SINGLE SOURCE OF TRUTH for responsive breakpoints.
 *
 * ⚠️  IMPORTANT: If you change values here, you MUST also update:
 *     1. frontend/src/index.css - Media queries at:
 *        - Line ~2345: @media (min-width: ${TABLET_BREAKPOINT}px)  [Desktop styles]
 *        - Line ~2411: @media (max-width: ${TABLET_BREAKPOINT - 1}px)  [Tablet styles]
 *        - Line ~2639: @media (max-width: ${MOBILE_BREAKPOINT}px)  [Mobile styles]
 *
 * Why can't CSS use these values directly?
 * CSS media queries don't support CSS custom properties (variables).
 * This is a CSS spec limitation, not a tooling issue.
 *
 * ============================================================================
 * BREAKPOINT OVERVIEW
 * ============================================================================
 *
 * MOBILE_BREAKPOINT (768px):
 *   - True mobile devices (phones)
 *   - max-width: 767px triggers mobile-specific styles
 *   - Used in: index.css (CSS media query)
 *
 * TABLET_BREAKPOINT (1440px):
 *   - Separates tablet from desktop
 *   - Desktop: min-width: 1440px (side-by-side layout)
 *   - Tablet:  max-width: 1439px (meter-focused layout)
 *   - Used in: InputContainer.tsx (JS), index.css (CSS media queries)
 *
 * ============================================================================
 */

// Mobile breakpoint - true mobile devices (phones)
export const MOBILE_BREAKPOINT = 768

// Tablet/desktop breakpoint - controls layout mode
export const TABLET_BREAKPOINT = 1440

// Pre-built media query strings for useMediaQuery hook
export const MEDIA_QUERIES = {
  /** Matches mobile layout (phones, below 768px) */
  isMobile: `(max-width: ${MOBILE_BREAKPOINT - 1}px)`,

  /** Matches tablet layout (768px to 1439px) */
  isTablet: `(max-width: ${TABLET_BREAKPOINT - 1}px)`,

  /** Matches desktop layout (at or above 1440px) */
  isDesktop: `(min-width: ${TABLET_BREAKPOINT}px)`,
} as const
