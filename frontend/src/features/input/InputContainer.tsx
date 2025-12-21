import { useEffect, useRef, useState } from 'react'
import { MEDIA_QUERIES } from '../../breakpoints'
import { useWhichInput } from '../meter/useWhichInput'
import AudioRecorder from './AudioRecorder'
import GettingStarted from './GettingStarted'
import TextInput from './TextInput'
import { ModelSelector } from './components/ModelSelector'
import { useMediaQuery } from './hooks'

const InputContainer = () => {
  const { value } = useWhichInput()
  // isMobileOrTablet matches tablet and mobile (< 1440px)
  const isMobileOrTablet = useMediaQuery(MEDIA_QUERIES.isMobileOrTablet)
  const [displayValue, setDisplayValue] = useState(value)
  const isInitialMount = useRef(true)

  useEffect(() => {
    // Skip transition on initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false
      setDisplayValue(value)
      return
    }

    // Use View Transitions API if available (desktop only)
    if (isMobileOrTablet) {
      // Mobile/tablet: simple state update without transition
      setDisplayValue(value)
    } else {
      // Desktop: use View Transitions API if available
      try {
        const transition = document.startViewTransition?.(() => {
          setDisplayValue(value)
        })
        if (!transition) {
          setDisplayValue(value)
        }
      } catch (error) {
        // Fallback if transition fails
        if (import.meta.env.DEV) console.warn('View Transition failed:', error)
        setDisplayValue(value)
      }
    }
  }, [value, isMobileOrTablet])

  const content = (() => {
    if (displayValue === 'off') return <GettingStarted />
    if (displayValue === 'text') return <TextInput />
    return <AudioRecorder />
  })()

  // On mobile/tablet, input controls are now in the meter (MobileInputControls)
  // Only render ModelSelector for dev override functionality
  if (isMobileOrTablet) {
    return (
      <section
        className="input-container input-container--mobile-hidden"
        data-testid="input-container"
      >
        <ModelSelector />
      </section>
    )
  }

  // Desktop: full input container with content
  return (
    <section className="input-container" data-testid="input-container">
      <div className="input-container__port" data-cable-anchor="input" aria-hidden="true" />
      <div className="input-container__content">{content}</div>
      <ModelSelector />
    </section>
  )
}

export default InputContainer
