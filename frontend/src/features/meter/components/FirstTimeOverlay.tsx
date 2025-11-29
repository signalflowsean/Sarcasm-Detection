import { useState, useEffect, useRef } from 'react'

const STORAGE_KEY = 'sarcasm-detector-visited'

const FirstTimeOverlay = () => {
  const [showOverlay, setShowOverlay] = useState(false)
  const [position, setPosition] = useState({ left: '50%', top: '45%' })
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Check if user has visited before
    const hasVisited = localStorage.getItem(STORAGE_KEY)
    if (!hasVisited) {
      setShowOverlay(true)
      
      // Position overlay based on rotary knob location
      let animationFrameId: number;
      const tryPositionOverlay = () => {
        const knob = document.querySelector('.rotary__knob') as HTMLElement;
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
        } else {
          animationFrameId = requestAnimationFrame(tryPositionOverlay);
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

  if (!showOverlay) return null

  return (
    <div className="first-time-overlay" onClick={handleDismiss}>
      <div 
        ref={contentRef}
        className="first-time-overlay__content"
        style={{ 
          left: position.left, 
          top: position.top,
          transform: 'translate(0, -50%)'
        }}
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

