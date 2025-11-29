import { useEffect, useRef, useState } from 'react'
import { useWhichInput } from '../../meter/useWhichInput'
import MobileModal from './MobileModal'
import Portal from './Portal'
import { KeyboardIcon } from '../../meter/components/icons'

type Props = {
  children: React.ReactNode
}

const MobileInputOverlay = ({ children }: Props) => {
  const { value } = useWhichInput()
  const [open, setOpen] = useState(false)
  const [pulsate, setPulsate] = useState(false)
  const prev = useRef(value)

  useEffect(() => {
    if (prev.current !== value && !open) {
      setPulsate(true)
      const t = setTimeout(() => setPulsate(false), 600)
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

  const title = value === 'off' ? 'Getting Started' : value === 'text' ? 'Text Input' : 'Audio Recorder'
  const label = value === 'off' ? 'Open getting started' : value === 'text' ? 'Open text input' : 'Open audio recorder'

  let launcherClass = 'audio-recorder__launcher'
  if (open) launcherClass += ' is-hidden'
  if (pulsate) launcherClass += ' audio-recorder__launcher--pulsate'

  return (
    <>
      <Portal target="mobile-launcher">
        <button type="button" className={launcherClass} aria-label={label} onClick={() => setOpen(true)}>
          {icon}
        </button>
      </Portal>
      {open && (
        <Portal target="body">
          <MobileModal open={open} onClose={() => setOpen(false)} title={title}>
            {children}
          </MobileModal>
        </Portal>
      )}
    </>
  )
}

export default MobileInputOverlay


