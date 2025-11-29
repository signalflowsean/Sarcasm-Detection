import { useWhichInput } from '../meter/useWhichInput'
import { useMediaQuery } from './hooks'
import { useEffect, useRef, useState } from 'react'
import GettingStarted from './GettingStarted'
import TextInput from './TextInput'
import AudioRecorder from './AudioRecorder'
import MobileInputOverlay from './components/MobileInputOverlay'

const InputContainer = () => {
  const { value } = useWhichInput()
  const isMobile = useMediaQuery('(max-width: 1299px)')
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
      document.startViewTransition?.(() => {
        setDisplayValue(value)
      })
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
      <MobileInputOverlay>
        <section className="input-container">
          <div className="input-container__port" data-cable-anchor="input" aria-hidden />
          {content}
        </section>
      </MobileInputOverlay>
    )
  }

  return (
    <section className="input-container">
      <div className="input-container__port" data-cable-anchor="input" aria-hidden />
      <div className="input-container__content">
        {content}
      </div>
    </section>
  )
}

export default InputContainer
