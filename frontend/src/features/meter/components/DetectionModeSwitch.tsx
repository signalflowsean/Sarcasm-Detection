import React, { useCallback } from 'react'
import { KeyboardIcon, MicIcon } from './icons'

export type DetectionMode = 'lexical' | 'prosodic'

const STORAGE_KEY = 'sarcasm-detector-visited'

interface DetectionModeSwitchProps {
  /** Current detection mode */
  value: DetectionMode
  /** Callback when mode changes */
  onChange: (mode: DetectionMode) => void
  /** Whether the switch is disabled */
  disabled?: boolean
}

/**
 * Horizontal toggle switch for selecting detection mode.
 * Left position: Lexical (text-based detection)
 * Right position: Prosodic (audio-based detection)
 *
 * Styled with retro metal aesthetic to match the meter.
 */
const DetectionModeSwitch: React.FC<DetectionModeSwitchProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const isLexical = value === 'lexical'

  const handleToggle = useCallback(() => {
    if (disabled) return
    onChange(isLexical ? 'prosodic' : 'lexical')
    // Dismiss first-time overlay on mobile/tablet when mode is toggled
    localStorage.setItem(STORAGE_KEY, 'true')
  }, [disabled, isLexical, onChange])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return

      switch (e.key) {
        case ' ':
        case 'Enter':
          e.preventDefault()
          handleToggle()
          break
        case 'ArrowLeft':
          e.preventDefault()
          if (!isLexical) onChange('lexical')
          break
        case 'ArrowRight':
          e.preventDefault()
          if (isLexical) onChange('prosodic')
          break
      }
    },
    [disabled, handleToggle, isLexical, onChange]
  )

  const modeLabel = isLexical ? 'Lexical (text)' : 'Prosodic (audio)'

  return (
    <div
      className={`detection-switch ${disabled ? 'detection-switch--disabled' : ''}`}
      role="switch"
      aria-checked={!isLexical}
      aria-label={`Detection mode: ${modeLabel}. Use arrow keys or space to toggle.`}
      tabIndex={disabled ? -1 : 0}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      data-testid="detection-mode-switch"
    >
      {/* Track */}
      <div className="detection-switch__track" aria-hidden="true">
        {/* Left icon (Lexical) */}
        <span
          className={`detection-switch__icon detection-switch__icon--left ${isLexical ? 'is-active' : ''}`}
          title="Lexical detection"
        >
          <KeyboardIcon />
        </span>

        {/* Toggle knob */}
        <span
          className={`detection-switch__knob ${isLexical ? 'detection-switch__knob--left' : 'detection-switch__knob--right'}`}
        />

        {/* Right icon (Prosodic) */}
        <span
          className={`detection-switch__icon detection-switch__icon--right ${!isLexical ? 'is-active' : ''}`}
          title="Prosodic detection"
        >
          <MicIcon />
        </span>
      </div>

      {/* Labels below the switch */}
      <div className="detection-switch__labels" aria-hidden="true">
        <span className={`detection-switch__label ${isLexical ? 'is-active' : ''}`}>Text</span>
        <span className={`detection-switch__label ${!isLexical ? 'is-active' : ''}`}>Audio</span>
      </div>
    </div>
  )
}

export default DetectionModeSwitch
