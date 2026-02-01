import { useEffect, useRef, useState } from 'react'
import { isChromeAndroid, isFirefox } from '../utils'
import { isDev } from '../utils/env'

type BrowserWarning = 'chrome-android' | 'firefox' | null

/**
 * Determines which browser warning to show, if any.
 * Priority: Firefox > Chrome Android (Firefox message is more relevant if both match somehow)
 */
const getBrowserWarning = (): BrowserWarning => {
  if (isFirefox()) return 'firefox'
  if (isChromeAndroid()) return 'chrome-android'
  return null
}

const MESSAGES = {
  'chrome-android': {
    title: 'Whoops, Wrong Browser!',
    body: "Chrome for Android and our speech-to-text feature aren't exactly on speaking terms. Try Chrome on desktop or Safari on iPhone for the full sarcasm-detecting experience.",
    cta: "Got it, I'll survive",
  },
  firefox: {
    title: 'Firefox, We Need to Talk...',
    body: "Speech-to-text on Firefox is like a bad phone connection — you'll get the gist, but it's not pretty. For best results, switch to Chrome.",
    cta: "Fine, I'll deal with it",
  },
}

/**
 * Modal that warns users about browser compatibility issues.
 * - Chrome on Android: Speech-to-text not supported
 * - Firefox (all): Degraded speech-to-text quality
 *
 * Uses native <dialog> element for accessibility.
 * Shows on every visit (no persistence).
 *
 * Dev mode: Press "B" to toggle modal visibility for testing.
 * Press "B" again to cycle between Chrome Android and Firefox variants.
 */
const BrowserSupportModal = () => {
  const [warning, setWarning] = useState<BrowserWarning>(null)
  const [devOverride, setDevOverride] = useState<BrowserWarning>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  // Detect browser on mount (client-side only)
  useEffect(() => {
    setWarning(getBrowserWarning())
  }, [])

  // Dev mode: Press "B" to toggle modal for testing
  useEffect(() => {
    if (!isDev()) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'KeyB') return
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return

      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      e.preventDefault()

      setDevOverride(prev => {
        // Cycle: null -> chrome-android -> firefox -> null
        if (prev === null) {
          console.log('🔧 Dev mode: Showing Chrome Android browser modal (press B to cycle)')
          return 'chrome-android'
        } else if (prev === 'chrome-android') {
          console.log('🔧 Dev mode: Showing Firefox browser modal (press B to hide)')
          return 'firefox'
        } else {
          console.log('🔧 Dev mode: Browser modal hidden (press B to show)')
          return null
        }
      })
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Effective warning: dev override takes precedence
  const effectiveWarning = devOverride ?? warning

  // Open modal when warning is detected
  useEffect(() => {
    if (effectiveWarning && dialogRef.current && !dialogRef.current.open) {
      dialogRef.current.showModal()
    }
  }, [effectiveWarning])

  const handleClose = () => {
    dialogRef.current?.close()
    // Only clear natural warning if not in dev override mode
    if (devOverride === null) {
      setWarning(null)
    } else {
      // In dev mode, closing clears the override
      setDevOverride(null)
    }
  }

  // Handle backdrop click (click on dialog element itself, not content)
  const handleDialogClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      handleClose()
    }
  }

  if (!effectiveWarning) return null

  const { title, body, cta } = MESSAGES[effectiveWarning]

  return (
    <dialog
      ref={dialogRef}
      className="browser-support-modal"
      onClose={handleClose}
      onClick={handleDialogClick}
      aria-labelledby="browser-support-title"
      aria-describedby="browser-support-body"
      data-testid="browser-support-modal"
    >
      <div className="browser-support-modal__content">
        <button
          type="button"
          className="browser-support-modal__close"
          onClick={handleClose}
          aria-label="Close"
        >
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

        <div className="browser-support-modal__icon" aria-hidden="true">
          {effectiveWarning === 'chrome-android' ? '📵' : '🦊'}
        </div>

        <h2 id="browser-support-title" className="browser-support-modal__title">
          {title}
        </h2>

        <p id="browser-support-body" className="browser-support-modal__body">
          {body}
        </p>

        <button type="button" className="browser-support-modal__cta" onClick={handleClose}>
          {cta}
        </button>
      </div>
    </dialog>
  )
}

export default BrowserSupportModal
