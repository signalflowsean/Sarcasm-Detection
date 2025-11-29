import { useState, useEffect, useRef } from 'react'

const STORAGE_KEY = 'sarcasm-detector-visited'

const FirstTimeOverlay = () => {
  const [showOverlay, setShowOverlay] = useState(false)
  const [position, setPosition] = useState({ left: '50%', top: '45%' })
  const contentRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

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
          // Position to the right of the knob - arrow will start here
          const rightX = rect.right + 80;
          const centerY = rect.top + rect.height / 2;
          // Use viewport-relative positioning
          setPosition({
            left: `${rightX}px`,
            top: `${centerY}px`
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
      <div 
        ref={contentRef}
        className="first-time-overlay__content"
        style={{ 
          left: position.left, 
          top: position.top,
          transform: 'translate(0, -50%)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Compact clockwise rotation arrow - about 30 degrees */}
        <svg 
          className="first-time-overlay__arrow"
          viewBox="0 0 200 200" 
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Arc going clockwise from top, ~50 degrees */}
          <path
            d="M 100 40 A 60 60 0 0 1 148 75"
            fill="none"
            stroke="#1a1a1a"
            strokeWidth="10"
            strokeLinecap="round"
            className="arrow-path-bg"
          />
          <path
            d="M 100 40 A 60 60 0 0 1 148 75"
            fill="none"
            stroke="#ffffff"
            strokeWidth="7"
            strokeLinecap="round"
            className="arrow-path"
          />
          {/* Arrowhead at the end - aligned with arc tangent */}
          <g className="arrow-head-bg">
            <path
              d="M 157 93 L 137 76 L 155 66 Z"
              fill="#1a1a1a"
              stroke="#1a1a1a"
              strokeWidth="3"
              strokeLinejoin="round"
            />
          </g>
          <g className="arrow-head">
            <path
              d="M 157 93 L 137 76 L 155 66 Z"
              fill="#ffffff"
            />
          </g>
        </svg>
        
        <p className="first-time-overlay__text">
          Turn the Knob to Start Detecting Sarcasm
        </p>
      </div>
    </div>
  )
}

export default FirstTimeOverlay
