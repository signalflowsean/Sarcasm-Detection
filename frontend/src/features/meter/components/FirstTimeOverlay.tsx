import { useState, useEffect, useRef } from 'react'

const STORAGE_KEY = 'sarcasm-detector-visited'

const FirstTimeOverlay = () => {
  const [showOverlay, setShowOverlay] = useState(false)
  const [position, setPosition] = useState({ left: '50%', top: '45%' })
  const [_arrowPosition, setArrowPosition] = useState({ left: '50%', top: '45%', size: 100 })
  const overlayRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Check if user has visited before
    const hasVisited = localStorage.getItem(STORAGE_KEY)
    let animationFrameId: number | undefined;
    let retryCount = 0;
    const MAX_RETRIES = 100; // Maximum number of animation frames to try
    const MAX_TIME_MS = 5000; // Maximum time to wait (5 seconds)
    const startTime = Date.now();
    
    if (!hasVisited) {
      setShowOverlay(true)
      
      // Position overlay based on rotary knob location
      const tryPositionOverlay = () => {
        const knob = document.querySelector('.rotary__knob') as HTMLElement;
        const elapsedTime = Date.now() - startTime;
        
        if (knob) {
          const rect = knob.getBoundingClientRect();
          // Position text to the right of the knob
          const rightX = rect.right + 80;
          const centerY = rect.top + rect.height / 2;
          // Use viewport-relative positioning
          setPosition({
            left: `${rightX}px`,
            top: `${centerY}px`
          });
          
          // Position arrow centered on the knob
          const knobCenterX = rect.left + rect.width / 2;
          const knobCenterY = rect.top + rect.height / 2;
          // Arrow should be about 1/3 of knob size larger than the knob
          const arrowSize = rect.width * 1.33;
          setArrowPosition({
            left: `${knobCenterX}px`,
            top: `${knobCenterY}px`,
            size: arrowSize
          });
        } else if (retryCount < MAX_RETRIES && elapsedTime < MAX_TIME_MS) {
          // Only retry if we haven't exceeded the maximum retries or time
          retryCount++;
          animationFrameId = requestAnimationFrame(tryPositionOverlay);
        } else {
          // Give up after max retries/time - fallback to center position
          console.warn('FirstTimeOverlay: Could not find .rotary__knob element after', retryCount, 'retries and', elapsedTime, 'ms');
        }
      };
      tryPositionOverlay();
    }
    // Cleanup animation frame on unmount
    return () => {
      if (typeof animationFrameId === 'number') {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true')
    setShowOverlay(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
      handleDismiss()
    }
  }

  // Auto-focus the overlay when it appears for keyboard accessibility
  useEffect(() => {
    if (showOverlay && overlayRef.current) {
      overlayRef.current.focus()
    }
  }, [showOverlay])

  if (!showOverlay) return null

  return (
    <div 
      ref={overlayRef}
      className="first-time-overlay" 
      onClick={handleDismiss}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome tutorial - Turn the knob to start detecting sarcasm"
      tabIndex={0}
    >
      {/* Arrow positioned on the knob itself */}
      {/* TODO: Add arrow */}
      
      {/* Text positioned to the right of knob */}
      <div 
        ref={contentRef}
        className="first-time-overlay__content"
        style={{ 
          left: position.left, 
          top: position.top,
          transform: 'translate(0, -50%)',
          flexDirection: 'column',
          alignItems: 'flex-start'
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <p className="first-time-overlay__text">
          Turn the Knob to Start Detecting Sarcasm
        </p>
      </div>
    </div>
  )
}

export default FirstTimeOverlay
