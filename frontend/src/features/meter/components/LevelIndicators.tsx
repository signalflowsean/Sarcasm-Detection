import { useEffect, useRef, useState } from 'react'

/**
 * SVG-based level indicators that follow the EXACT ellipse arc paths.
 *
 * The meter display uses CSS clip-path: ellipse(50% 100% at bottom center) for each row.
 * This creates elliptical arcs where:
 * - Prosodic (row 2): y = 50 - 25 * sqrt(1 - ((x-50)/50)²)
 * - Lexical (row 3): y = 75 - 25 * sqrt(1 - ((x-50)/50)²)
 *
 * The left/right boundaries clip with triangular regions, so arcs don't start at x=0.
 * We calculate the intersection points where the ellipse meets the boundary.
 */

type LevelIndicatorsProps = {
  prosodicValue: number // 0-1
  lexicalValue: number // 0-1
  prosodicEnabled: boolean
  lexicalEnabled: boolean
  isLoading: boolean
  isPoweringOn: boolean
  animDuration: number
}

/**
 * Calculate the Y position on an ellipse arc given X position.
 * The ellipse is defined by clip-path: ellipse(50% 100% at bottom center)
 * for each row (25% height).
 *
 * @param x - X position as percentage (0-100)
 * @param rowBottom - Bottom Y of the row in container percentage (50 for prosodic, 75 for lexical)
 * @returns Y position as percentage (0-100)
 */
const getEllipseY = (x: number, rowBottom: number): number => {
  // Ellipse: ((x-50)/50)² + ((y-rowBottom)/(-25))² = 1
  // Solve for y (taking the upper arc): y = rowBottom - 25 * sqrt(1 - ((x-50)/50)²)
  const u = (x - 50) / 50
  const uSquared = u * u
  if (uSquared > 1) return rowBottom // Outside ellipse
  return rowBottom - 25 * Math.sqrt(1 - uSquared)
}

/**
 * Calculate the tangent angle at a point on the ellipse.
 */
const getEllipseTangent = (x: number): number => {
  // dy/dx = (25 * u) / (50 * sqrt(1 - u²)) where u = (x-50)/50
  const u = (x - 50) / 50
  const uSquared = u * u
  if (uSquared >= 1) return 0
  const dydx = (25 * u) / (50 * Math.sqrt(1 - uSquared))
  return Math.atan(dydx) * (180 / Math.PI)
}

/**
 * Find where the ellipse arc intersects the boundary triangle.
 * Left boundary: x = y/3 (diagonal from top-left to 1/3 width at bottom)
 *
 * Derivation:
 * 1. Boundary line: x = y/3 (in percentage coordinates)
 * 2. Ellipse: y = rowBottom - 25*sqrt(1-u²) where u = (x-50)/50
 *
 * Substituting x = 50u + 50 into the boundary equation and solving:
 * 3(50u + 50) = rowBottom - 25*sqrt(1-u²)
 * After squaring and simplifying: 37u² + 48u + 15 = 0 (for prosodic)
 *
 * For prosodic (rowBottom=50): intersection at x≈11.4%, y≈34.1%
 * For lexical (rowBottom=75): intersection at x≈18.5%, y≈55.6%
 */
const findBoundaryIntersection = (rowBottom: number): { x: number; y: number } => {
  // Solve the quadratic equation: au² + bu + c = 0
  // where u = (x - 50) / 50 is the normalized x-coordinate

  // r: offset from the reference point (150) used to derive coefficients
  // This simplifies the algebra when computing b and c from rowBottom
  const r = rowBottom - 150

  // a: coefficient of u² (constant for all rows, derived from combining
  // the squared boundary equation with the ellipse equation)
  const a = 37

  // b: coefficient of u (varies with rowBottom, represents the linear term
  // from cross-multiplying the boundary and ellipse equations)
  const b = (-300 * r) / 625 // Simplifies to: 72 - 0.48 * rowBottom

  // c: constant term (varies with rowBottom, derived from the constant
  // terms when combining boundary line x = y/3 with ellipse equation)
  const c = (r * r - 625) / 625

  // Apply quadratic formula: u = (-b ± √(b² - 4ac)) / 2a
  const discriminant = b * b - 4 * a * c
  if (discriminant < 0) return { x: 0, y: rowBottom }

  // Take the negative root (-√discriminant) to get the left intersection point
  const u = (-b - Math.sqrt(discriminant)) / (2 * a)

  // Convert normalized u back to percentage x-coordinate
  const x = 50 * u + 50
  const y = getEllipseY(x, rowBottom)

  return { x, y }
}

// Pre-calculate the visible ranges for each arc
const PROSODIC_START = findBoundaryIntersection(50)
const PROSODIC_END = { x: 100 - PROSODIC_START.x, y: PROSODIC_START.y }
const LEXICAL_START = findBoundaryIntersection(75)
const LEXICAL_END = { x: 100 - LEXICAL_START.x, y: LEXICAL_START.y }

// Indicator size as percentage of container dimensions
const INDICATOR_WIDTH_PCT = 5
const INDICATOR_HEIGHT_PCT = 4

// Import shared needle rotation constants
import { NEEDLE_MIN_DEG, NEEDLE_MAX_DEG, NEEDLE_RANGE_DEG } from '../meterConstants'

const MAX_SIN = Math.sin((NEEDLE_MAX_DEG * Math.PI) / 180) // sin(55°) ≈ 0.819

/**
 * Convert a value (0-1) to a position fraction (0-1) that matches the needle's
 * sinusoidal arc. This ensures the level indicator appears at the same relative
 * horizontal position as the needle tip for any given value.
 *
 * The needle rotates from -55° to +55°, creating a sinusoidal x-position.
 * This function maps value → angle → sin(angle) → normalized fraction.
 */
const valueToNeedleAlignedFraction = (value: number): number => {
  // Convert value to needle rotation angle (same formula as Needle component)
  const angleDeg = NEEDLE_MIN_DEG + value * NEEDLE_RANGE_DEG
  const angleRad = (angleDeg * Math.PI) / 180

  // Convert angle to horizontal position fraction
  // sin(angle) ranges from -sin(55°) to +sin(55°), we normalize to 0-1
  return (Math.sin(angleRad) / MAX_SIN + 1) / 2
}

type IndicatorProps = {
  value: number
  variant: 'prosodic' | 'lexical'
  enabled: boolean
  isLoading: boolean
  isPoweringOn: boolean
  animDuration: number
  containerWidth: number
  containerHeight: number
}

const Indicator = ({
  value,
  variant,
  enabled,
  isLoading,
  isPoweringOn,
  animDuration,
  containerWidth,
  containerHeight,
}: IndicatorProps) => {
  // Track if animations are enabled - starts false to prevent initial position jump
  const [canAnimate, setCanAnimate] = useState(false)

  // Enable animations after component has mounted and painted
  useEffect(() => {
    // Use a small timeout to ensure initial position is painted before enabling transitions
    const timerId = setTimeout(() => setCanAnimate(true), 50)
    return () => clearTimeout(timerId)
  }, [])

  // Get the arc parameters for this variant
  const rowBottom = variant === 'prosodic' ? 50 : 75
  const arcStart = variant === 'prosodic' ? PROSODIC_START : LEXICAL_START
  const arcEnd = variant === 'prosodic' ? PROSODIC_END : LEXICAL_END

  // Map value (0-1) to x position along the visible arc using the same
  // sinusoidal scale as the needle. This ensures alignment between
  // the needle position and level indicator for single-input scenarios.
  const positionFraction = valueToNeedleAlignedFraction(value)
  const xPct = arcStart.x + positionFraction * (arcEnd.x - arcStart.x)

  // Get Y position on the ellipse curve
  const yPct = getEllipseY(xPct, rowBottom)

  // Get tangent angle for rotation
  const angle = getEllipseTangent(xPct)

  // Convert percentages to actual pixels
  const x = (xPct / 100) * containerWidth
  const y = (yPct / 100) * containerHeight

  // Indicator size in pixels
  const width = (INDICATOR_WIDTH_PCT / 100) * containerWidth
  const height = (INDICATOR_HEIGHT_PCT / 100) * containerHeight

  const animClass = [
    isLoading ? 'level-indicator--loading' : '',
    isPoweringOn ? 'level-indicator--powering-on' : '',
    !enabled ? 'level-indicator--disabled' : '',
  ]
    .filter(Boolean)
    .join(' ')

  // Colors - use muted grey when disabled
  const fill = enabled
    ? variant === 'prosodic'
      ? 'url(#prosodic-gradient)'
      : 'url(#lexical-gradient)'
    : 'url(#disabled-gradient)'

  const stroke = enabled ? (variant === 'prosodic' ? '#5a1520' : '#5c4020') : '#6f6a60'

  return (
    <g
      className={`level-indicator level-indicator--${variant} ${animClass}`}
      style={{
        transform: `translate(${x}px, ${y}px) rotate(${angle}deg)`,
        transition: canAnimate
          ? `transform ${animDuration}ms ease-out, opacity 300ms ease`
          : 'none',
        transformOrigin: '0 0',
        transformBox: 'fill-box',
      }}
    >
      <rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        rx={height * 0.2}
        ry={height * 0.2}
        fill={fill}
        stroke={stroke}
        strokeWidth={1}
      />
      {/* Highlight */}
      <rect
        x={-width / 2 + 2}
        y={-height / 2 + 1}
        width={width - 4}
        height={height * 0.35}
        rx={height * 0.15}
        fill="rgba(255,255,255,0.35)"
      />
    </g>
  )
}

const LevelIndicators = ({
  prosodicValue,
  lexicalValue,
  prosodicEnabled,
  lexicalEnabled,
  isLoading,
  isPoweringOn,
  animDuration,
}: LevelIndicatorsProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  // Refs to track animation frame IDs for proper cleanup
  const outerFrameRef = useRef<number | null>(null)
  const innerFrameRef = useRef<number | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateDimensions = () => {
      const rect = container.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        setDimensions({ width: rect.width, height: rect.height })
      }
    }

    updateDimensions()
    const observer = new ResizeObserver(updateDimensions)
    observer.observe(container)

    return () => observer.disconnect()
  }, [])

  // Make visible after dimensions are ready and a frame has passed
  useEffect(() => {
    if (dimensions && !isVisible) {
      // Wait for the SVG to be in position before showing
      outerFrameRef.current = requestAnimationFrame(() => {
        innerFrameRef.current = requestAnimationFrame(() => {
          setIsVisible(true)
        })
      })
    }

    return () => {
      // Cancel both animation frames on cleanup
      if (outerFrameRef.current !== null) {
        cancelAnimationFrame(outerFrameRef.current)
        outerFrameRef.current = null
      }
      if (innerFrameRef.current !== null) {
        cancelAnimationFrame(innerFrameRef.current)
        innerFrameRef.current = null
      }
    }
  }, [dimensions, isVisible])

  return (
    <div ref={containerRef} className="level-indicators-container" aria-hidden="true">
      {dimensions && (
        <svg
          className="level-indicators-svg"
          width={dimensions.width}
          height={dimensions.height}
          style={{
            overflow: 'visible',
            visibility: isVisible ? 'visible' : 'hidden',
          }}
        >
          <defs>
            {/* Vintage enamel indicator gradients */}
            <linearGradient id="prosodic-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#c83a4a" />
              <stop offset="50%" stopColor="#a82035" />
              <stop offset="100%" stopColor="#7a1525" />
            </linearGradient>
            <linearGradient id="lexical-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#c9923e" />
              <stop offset="50%" stopColor="#9a6930" />
              <stop offset="100%" stopColor="#6b4a22" />
            </linearGradient>
            <linearGradient id="disabled-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#a5a095" />
              <stop offset="50%" stopColor="#8a8578" />
              <stop offset="100%" stopColor="#6f6a60" />
            </linearGradient>
          </defs>

          <Indicator
            value={prosodicValue}
            variant="prosodic"
            enabled={prosodicEnabled}
            isLoading={isLoading && prosodicEnabled}
            isPoweringOn={isPoweringOn}
            animDuration={animDuration}
            containerWidth={dimensions.width}
            containerHeight={dimensions.height}
          />

          <Indicator
            value={lexicalValue}
            variant="lexical"
            enabled={lexicalEnabled}
            isLoading={isLoading && lexicalEnabled}
            isPoweringOn={isPoweringOn}
            animDuration={animDuration}
            containerWidth={dimensions.width}
            containerHeight={dimensions.height}
          />
        </svg>
      )}
    </div>
  )
}

export default LevelIndicators
