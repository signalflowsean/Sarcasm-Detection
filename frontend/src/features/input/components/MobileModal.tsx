import type { PropsWithChildren } from 'react'
import { useRef } from 'react'

type Props = PropsWithChildren<{
  open: boolean
  onClose: () => void
}>

const MobileModal = ({ open, onClose, children }: Props) => {
  const modalRef = useRef<HTMLDivElement>(null)
  const trapFocus = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return
    const root = modalRef.current
    if (!root) return
    const focusables = root.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
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


