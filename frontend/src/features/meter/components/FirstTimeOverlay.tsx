import { useEffect, useRef, useState } from 'react'
import { MEDIA_QUERIES } from '../../../breakpoints'
import { useMediaQuery } from '../../input/hooks'

const STORAGE_KEY = 'sarcasm-detector-visited'

const FirstTimeOverlay = () => {
  const [showOverlay, setShowOverlay] = useState(false)
  const [textPosition, setTextPosition] = useState({ left: '50%', top: '45%' })
  const overlayRef = useRef<HTMLDivElement>(null)
  const isTabletOrMobile = useMediaQuery(MEDIA_QUERIES.isMobileOrTablet)

  useEffect(() => {
    const hasVisited = localStorage.getItem(STORAGE_KEY)
    let animationFrameId: number | undefined
    let retryCount = 0
    const MAX_RETRIES = 100
    const MAX_TIME_MS = 5000
    const startTime = Date.now()

    if (!hasVisited) {
      setShowOverlay(true)

      const tryPositionOverlay = () => {
        // On mobile/tablet, position relative to the textarea (where typing happens)
        // On desktop, position relative to the rotary knob
        const targetSelector = isTabletOrMobile
          ? '.mobile-input-controls__textarea .shared-textarea, .mobile-input-controls__textarea textarea'
          : '.rotary__knob'
        const target = document.querySelector(targetSelector) as HTMLElement
        const elapsedTime = Date.now() - startTime

        if (target) {
          const rect = target.getBoundingClientRect()
          const centerX = rect.left + rect.width / 2

          // Position text above the target on mobile, below on desktop
          if (isTabletOrMobile) {
            setTextPosition({
              left: `${centerX}px`,
              top: `${rect.top - 10}px`,
            })
          } else {
            setTextPosition({
              left: `${centerX}px`,
              top: `${rect.bottom + 30}px`,
            })
          }
        } else if (retryCount < MAX_RETRIES && elapsedTime < MAX_TIME_MS) {
          retryCount++
          animationFrameId = requestAnimationFrame(tryPositionOverlay)
        }
      }
      tryPositionOverlay()
    }

    return () => {
      if (typeof animationFrameId === 'number') {
        cancelAnimationFrame(animationFrameId)
      }
    }
  }, [isTabletOrMobile])

  // Listen for localStorage changes (when RotarySwitch dismisses first-time state)
  useEffect(() => {
    const handleStorageChange = () => {
      const hasVisited = localStorage.getItem(STORAGE_KEY)
      if (hasVisited) {
        setShowOverlay(false)
      }
    }

    // Listen for storage events from other tabs/windows
    window.addEventListener('storage', handleStorageChange)

    // Also poll localStorage since storage events don't fire for same-tab changes
    const pollInterval = setInterval(() => {
      const hasVisited = localStorage.getItem(STORAGE_KEY)
      if (hasVisited) {
        setShowOverlay(false)
      }
    }, 100)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(pollInterval)
    }
  }, [])

  if (!showOverlay) return null

  // Different messages for mobile/tablet vs desktop
  const message = isTabletOrMobile
    ? 'Type Something to Detect Sarcasm'
    : 'Turn the Knob to Start Detecting Sarcasm'

  const ariaLabel = isTabletOrMobile
    ? 'Welcome hint - Type something to detect sarcasm'
    : 'Welcome hint - Turn the knob to start detecting sarcasm'

  return (
    <div
      ref={overlayRef}
      className="first-time-overlay"
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
    >
      {/* Instructional text - non-blocking */}
      <div
        className="first-time-overlay__content"
        style={{
          left: textPosition.left,
          top: textPosition.top,
          transform: 'translateX(-50%)',
        }}
      >
        <p className="first-time-overlay__text">{message}</p>
      </div>
    </div>
  )
}

export default FirstTimeOverlay
