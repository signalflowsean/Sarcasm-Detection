import { useEffect, useState } from 'react'

const CableOverlay = () => {
  const [pathD, setPathD] = useState<string>('')

  const recompute = () => {
    const meterAnchor = document.querySelector('[data-cable-anchor="meter"]') as HTMLElement | null
    const inputAnchor = document.querySelector('[data-cable-anchor="input"]') as HTMLElement | null
    const inputContainer = document.querySelector('.input-container') as HTMLElement | null
    const meterEl = document.querySelector('.meter') as HTMLElement | null
    const titleEl = document.querySelector('.title') as HTMLElement | null

    if (!meterAnchor || !inputAnchor || !inputContainer || !meterEl) {
      setPathD('')
      return
    }

    // Get bounding boxes
    const inputJack = inputAnchor.getBoundingClientRect()
    const meterJack = meterAnchor.getBoundingClientRect()
    const ic = inputContainer.getBoundingClientRect()
    const mr = meterEl.getBoundingClientRect()
    const title = titleEl?.getBoundingClientRect()

    // Clearance from markup
    const CLEARANCE = 10

    // Start point: input jack at top of input container
    const startX = inputJack.left + inputJack.width / 2
    const startY = inputJack.top + inputJack.height / 2

    // End point: meter jack
    const endX = meterJack.left + meterJack.width / 2
    const endY = meterJack.top + meterJack.height / 2

    // SECTION 1: First curve (OUTSIDE the container, hugging it)
    // The jack is at the CENTER TOP of the container
    // Calculate horizontal distance from jack to right edge
    const horizontalDistance = ic.right - startX
    
    // First 25% of horizontal distance: cable goes UP and RIGHT
    const point25X = startX + (horizontalDistance * 0.25)
    
    // At 25% mark, cable should be above container top by CLEARANCE
    const point25Y = ic.top - CLEARANCE
    
    // Peak Y: highest point, in gap between title and container
    const titleBottom = title ? title.bottom : ic.top - 100
    const peakY = titleBottom + CLEARANCE

    // Curve ends: CLEARANCE past the right edge of input container
    const curve1EndX = ic.right + CLEARANCE + 50 // Moved 50px right for better balance
    // Keep it just outside the container, not overlapping
    const curve1EndY = ic.top + CLEARANCE

    // Smooth bezier control points for first curve with gradual transition to vertical
    // Goes from start → point25 (up and right) → peak (continue up and right) → curve1End (smoothly downward)
    
    // c1: pull toward point25, moving upward and rightward
    const c1x = point25X
    const c1y = point25Y
    
    // c2: position between peak and endpoint for one smooth continuous arc
    // Stays at curve1EndX (not beyond it) to avoid curving back
    const c2x = curve1EndX
    const c2y = peakY + (curve1EndY - peakY) * 0.3

    // SECTION 2: Straight vertical line (corner is smoothed by adjusting section 1)
    const lineEndX = curve1EndX
    // End vertical line much higher up to allow for extra long, sweeping curve to meter
    const lineEndY = mr.bottom - 200

    // SECTION 3: Final curve to meter jack - smooth gradual arc with MORE curvature
    // Control points positioned farther from endpoints to create a rounder, more curved arc
    const verticalDistanceToMeter = endY - lineEndY
    
    // Position control points much farther out (50%) for a nicely rounded curve
    const c3x = lineEndX
    const c3y = lineEndY + verticalDistanceToMeter * 0.5
    
    const c4x = endX
    const c4y = endY - verticalDistanceToMeter * 0.5

    const path = 
      `M ${startX},${startY} ` +
      `C ${c1x},${c1y} ${c2x},${c2y} ${curve1EndX},${curve1EndY} ` +
      `L ${lineEndX},${lineEndY} ` +
      `C ${c3x},${c3y} ${c4x},${c4y} ${endX},${endY}`

    setPathD(path)
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      recompute()
    }, 100)

    const onResize = () => recompute()
    window.addEventListener('resize', onResize)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  if (!pathD) return null

  return (
    <svg className="cable-overlay" aria-hidden="true">
      <path d={pathD} stroke="#1f1f1f" strokeWidth="12" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d={pathD} stroke="#343434" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d={pathD} stroke="#555" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="7 10" opacity="0.9" />
      <path d={pathD} stroke="rgba(255,255,255,0.15)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default CableOverlay
