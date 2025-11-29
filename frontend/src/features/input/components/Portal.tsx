import { createPortal } from 'react-dom'
import { useState, useEffect } from 'react'

type Props = {
  children: React.ReactNode
  target?: 'body' | 'mobile-launcher'
}

const Portal = ({ children, target = 'body' }: Props) => {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  
  useEffect(() => {
    if (target === 'mobile-launcher') {
      // Wait for the mobile launcher portal to exist in the DOM
      const mobileTarget = document.getElementById('mobile-launcher-portal')
      if (mobileTarget) {
        setPortalTarget(mobileTarget)
      } else {
        // Fallback to body if target doesn't exist
        setPortalTarget(document.body)
      }
    } else {
      setPortalTarget(document.body)
    }
  }, [target])
  
  // Don't render until we have a target
  if (!portalTarget) return null
  
  return createPortal(children, portalTarget)
}

export default Portal


