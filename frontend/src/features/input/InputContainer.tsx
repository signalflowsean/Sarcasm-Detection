import { useWhichInput } from '../meter/useWhichInput'
import { useMediaQuery } from './hooks'
import { useEffect, useRef, useState } from 'react'
import GettingStarted from './GettingStarted'
import TextInput from './TextInput'
import AudioRecorder from './AudioRecorder'
import MobileInputOverlay from './components/MobileInputOverlay'
import { MEDIA_QUERIES } from '../../breakpoints'

const InputContainer = () => {
  const { value } = useWhichInput()
  const isMobile = useMediaQuery(MEDIA_QUERIES.isMobile)
  const [displayValue, setDisplayValue] = useState(value)
  const isInitialMount = useRef(true)

  useEffect(() => {
    // Skip transition on initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false
      setDisplayValue(value)
      return
    }

    // Use View Transitions API if available
    if (!isMobile) {
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
    } else {
      // Fallback without transition
      setDisplayValue(value)
    }
  }, [value, isMobile])

  const content = (() => {
    if (displayValue === 'off') return <GettingStarted />
    if (displayValue === 'text') return <TextInput />
    return <AudioRecorder />
  })()

  if (isMobile) {
    return (
      <section className="input-container">
        <div className="input-container__port" data-cable-anchor="input" aria-hidden="true" />
        <MobileInputOverlay>
          {({ onClose }) => {
            if (displayValue === 'off') return <GettingStarted />
            if (displayValue === 'text') return <TextInput onClose={onClose} />
            return <AudioRecorder onClose={onClose} />
          }}
        </MobileInputOverlay>
      </section>
    )
  }

  return (
    <section className="input-container">
      <div className="input-container__port" data-cable-anchor="input" aria-hidden="true" />
      <div className="input-container__content">{content}</div>
    </section>
  )
}

export default InputContainer
