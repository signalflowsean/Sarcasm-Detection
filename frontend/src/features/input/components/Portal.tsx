import { createPortal } from 'react-dom'
import { useState, useEffect } from 'react'

type Props = {
  children: React.ReactNode
  target?: 'body' | 'mobile-launcher'
}

const Portal = ({ children, target = 'body' }: Props) => {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (target === 'body') {
      setPortalTarget(document.body)
      return
    }

    // target === 'mobile-launcher'
    const targetId = 'mobile-launcher-portal'

    // Check if element already exists
    const existingTarget = document.getElementById(targetId)
    if (existingTarget) {
      setPortalTarget(existingTarget)
      return
    }

    // Element doesn't exist yet, set up MutationObserver to watch for it
    const observer = new MutationObserver(() => {
      const element = document.getElementById(targetId)
      if (element) {
        setPortalTarget(element)
        observer.disconnect()
      }
    })

    // Observe the entire document for added nodes
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    // Cleanup observer on unmount or target change
    return () => {
      observer.disconnect()
    }
  }, [target])

  // Don't render until we have a target
  if (!portalTarget) return null

  return createPortal(children, portalTarget)
}

export default Portal
