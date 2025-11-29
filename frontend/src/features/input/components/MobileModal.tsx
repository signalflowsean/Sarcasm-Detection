import type { PropsWithChildren } from 'react'
import { useRef, useEffect } from 'react'

type Props = PropsWithChildren<{
  open: boolean
  onClose: () => void
}>

const MobileModal = ({ open, onClose, children }: Props) => {
  const modalRef = useRef<HTMLDivElement>(null)
  const focusablesRef = useRef<HTMLElement[]>([])
  
  // Cache focusable elements when modal opens or children change
  useEffect(() => {
    if (!open) return
    
    const updateFocusables = () => {
      const root = modalRef.current
      if (!root) return
      
      // Comprehensive selector that excludes disabled and hidden elements
      const selector = [
        'button:not(:disabled):not([aria-hidden="true"])',
        '[href]:not([aria-hidden="true"])',
        'input:not(:disabled):not([aria-hidden="true"])',
        'select:not(:disabled):not([aria-hidden="true"])',
        'textarea:not(:disabled):not([aria-hidden="true"])',
        '[tabindex]:not([tabindex="-1"]):not(:disabled):not([aria-hidden="true"])',
      ].join(', ')
      
      const elements = Array.from(root.querySelectorAll<HTMLElement>(selector))
      // Filter out elements that are visually hidden or have inert parents
      focusablesRef.current = elements.filter((el) => {
        return el.offsetParent !== null && !el.closest('[inert]')
      })
    }
    
    updateFocusables()
    
    // Update focusables if DOM changes (e.g., buttons become enabled/disabled)
    const observer = new MutationObserver(updateFocusables)
    if (modalRef.current) {
      observer.observe(modalRef.current, { 
        attributes: true, 
        childList: true, 
        subtree: true,
        attributeFilter: ['disabled', 'aria-hidden', 'tabindex']
      })
    }
    
    return () => observer.disconnect()
  }, [open, children])
  
  const trapFocus = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return
    const focusables = focusablesRef.current
    if (focusables.length === 0) return
    
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    
    if (e.shiftKey && document.activeElement === first) {
      last.focus()
      e.preventDefault()
    } else if (!e.shiftKey && document.activeElement === last) {
      first.focus()
      e.preventDefault()
    }
  }

  if (!open) return null
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="audio-recorder__modal"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
        trapFocus(e)
      }}
    >
      <div className="audio-recorder__backdrop" onClick={onClose} onPointerDown={(e) => e.stopPropagation()} />
      <div className="audio-recorder__modal__content" ref={modalRef}>
        <div className="audio-recorder__modal__header">
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close recorder">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              width="20"
              height="20"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default MobileModal


