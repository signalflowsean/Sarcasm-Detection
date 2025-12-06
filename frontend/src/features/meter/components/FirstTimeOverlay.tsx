import { useState, useEffect, useRef } from 'react'

const STORAGE_KEY = 'sarcasm-detector-visited'

const FirstTimeOverlay = () => {
  const [showOverlay, setShowOverlay] = useState(false)
  const [textPosition, setTextPosition] = useState({ left: '50%', top: '45%' })
  const overlayRef = useRef<HTMLDivElement>(null)

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
        const knob = document.querySelector('.rotary__knob') as HTMLElement
        const elapsedTime = Date.now() - startTime
        
        if (knob) {
          const rect = knob.getBoundingClientRect()
          const knobCenterX = rect.left + rect.width / 2
          
          // Position text below the knob
          setTextPosition({
            left: `${knobCenterX}px`,
            top: `${rect.bottom + 30}px`
          })
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
  }, [])

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

  return (
    <div 
      ref={overlayRef}
      className="first-time-overlay" 
      role="status"
      aria-live="polite"
      aria-label="Welcome hint - Turn the knob to start detecting sarcasm"
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
        <p className="first-time-overlay__text">
          Turn the Knob to Start Detecting Sarcasm
        </p>
      </div>
    </div>
  )
}

export default FirstTimeOverlay
