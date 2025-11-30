import { useEffect, useRef, useState } from 'react'
import { useWhichInput } from '../../meter/useWhichInput'
import { MODE_LABELS } from '../../meter/constants'
import MobileModal from './MobileModal'
import Portal from './Portal'
import { KeyboardIcon } from '../../meter/components/icons'

type Props = {
  children: React.ReactNode | ((props: { onClose: () => void }) => React.ReactNode)
}

const MobileInputOverlay = ({ children }: Props) => {
  const { value } = useWhichInput()
  const [open, setOpen] = useState(false)
  const [pulsate, setPulsate] = useState(false)
  const prev = useRef(value)
  const [announcement, setAnnouncement] = useState('')
  
  const handleClose = () => setOpen(false)

  useEffect(() => {
    if (prev.current !== value && !open) {
      setPulsate(true)
      const t = setTimeout(() => setPulsate(false), 600)
      
      // Announce mode change to screen readers
      const modeLabel = MODE_LABELS[value]?.description || 'Unknown mode'
      setAnnouncement(`Input mode changed to ${modeLabel}`)
      
      prev.current = value
      return () => clearTimeout(t)
    }
    prev.current = value
  }, [value, open])

  const icon = (() => {
    if (value === 'off') {
      // upright info icon
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
          {/* outer circle */}
          <circle cx="12" cy="12" r="10" />
          {/* stem */}
          <line x1="12" y1="16" x2="12" y2="12" />
          {/* dot */}
          <circle cx="12" cy="8" r="1.4" fill="currentColor" stroke="none" />
        </svg>
      )
    }
    if (value === 'text') {
      // reuse rotary KeyboardIcon at a smaller size
      return (
        <span className="launcher-icon">
          <KeyboardIcon />
        </span>
      )
    }
    // mic
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" x2="12" y1="19" y2="22" />
      </svg>
    )
  })()

  const label = MODE_LABELS[value]?.action || 'Open input'

  let launcherClass = 'audio-recorder__launcher'
  if (open) launcherClass += ' is-hidden'
  if (pulsate) launcherClass += ' audio-recorder__launcher--pulsate'

  return (
    <>
      {/* Visually hidden live region for screen reader announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0
        }}
      >
        {announcement}
      </div>
      <Portal target="mobile-launcher">
        <button type="button" className={launcherClass} aria-label={label} onClick={() => setOpen(true)}>
          {icon}
        </button>
      </Portal>
      {open && (
        <Portal target="body">
          <MobileModal open={open} onClose={handleClose}>
            {typeof children === 'function' ? children({ onClose: handleClose }) : children}
          </MobileModal>
        </Portal>
      )}
    </>
  )
}

export default MobileInputOverlay
