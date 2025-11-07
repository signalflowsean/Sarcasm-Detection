import type { PropsWithChildren } from 'react'
import { useEffect, useRef } from 'react'

type Props = PropsWithChildren<{
  open: boolean
  onClose: () => void
}>

const MobileModal = ({ open, onClose, children }: Props) => {
  const modalRef = useRef<HTMLDivElement>(null)
  const focusablesRef = useRef<HTMLElement[]>([])
  
  // Cache focusable elements when modal opens
  useEffect(() => {
    if (open && modalRef.current) {
      const focusables = Array.from(
        modalRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"]):not(:disabled)'
        )
      )
      focusablesRef.current = focusables
    }
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
      <div className="audio-recorder__backdrop" />
      <div className="audio-recorder__modal__content" ref={modalRef}>
        <div className="audio-recorder__modal__header">
          <h2>Recorder</h2>
          <button type="button" className="audio-btn" onClick={onClose} aria-label="Close recorder">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default MobileModal


