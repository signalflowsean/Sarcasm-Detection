import { useEffect, useRef, useState } from 'react'
import { MEDIA_QUERIES } from '../../breakpoints'
import GettingStarted from '../input/GettingStarted'
import MobileInputControls from '../input/components/MobileInputControls'
import MobileModal from '../input/components/MobileModal'
import { useMediaQuery } from '../input/hooks'
import DetectionModeSwitch, { type DetectionMode } from './components/DetectionModeSwitch'
import LevelIndicators from './components/LevelIndicators'
import RotarySwitch from './components/RotarySwitch'
import {
  DetectionState,
  LEVEL_INDICATOR_ANIM_DURATION_MS,
  LEVEL_INDICATOR_RETURN_DURATION_MS,
  NEEDLE_ANIM_DURATION_MS,
  NEEDLE_MIN_DEG,
  NEEDLE_RANGE_DEG,
  NEEDLE_RETURN_DURATION_MS,
  POWER_ON_STUTTER_DURATION_MS,
} from './meterConstants'
import type { Tick } from './types'
import { useDetection } from './useDetection'
import { useWhichInput } from './useWhichInput'
import { TICKS } from './utils'

type PowerState = 'off' | 'on'
type InputMode = 'text' | 'audio' | 'off'

const MeterSection = () => {
  const { value } = useWhichInput()
  const {
    state: detectionState,
    isLoading,
    cableAnimating,
    lexicalValue,
    prosodicValue,
    mainValue,
    isReliable,
  } = useDetection()

  // Check if we're on mobile/tablet
  const isTabletOrMobile = useMediaQuery(MEDIA_QUERIES.isMobileOrTablet)

  // Detection mode for mobile/tablet (lexical = text, prosodic = audio)
  const [detectionMode, setDetectionMode] = useState<DetectionMode>('lexical')

  // Derive power state and input mode
  // On mobile/tablet: power is always "on", mode comes from detection switch
  // On desktop: power and mode come from rotary switch
  const desktopPowerState: PowerState = value === 'off' ? 'off' : 'on'
  const powerState: PowerState = isTabletOrMobile ? 'on' : desktopPowerState

  const mobileInputMode: InputMode = detectionMode === 'lexical' ? 'text' : 'audio'
  const inputMode: InputMode = isTabletOrMobile ? mobileInputMode : (value as InputMode)

  // Track previous power state to detect power-on transition
  const prevPowerStateRef = useRef<PowerState>(powerState)
  const [isPoweringOn, setIsPoweringOn] = useState(false)

  // Info modal state (for mobile/tablet getting started)
  const [showInfoModal, setShowInfoModal] = useState(false)

  // Detect power-on transition
  useEffect(() => {
    if (prevPowerStateRef.current === 'off' && powerState === 'on') {
      setIsPoweringOn(true)
      const timer = setTimeout(() => {
        setIsPoweringOn(false)
      }, POWER_ON_STUTTER_DURATION_MS)
      return () => clearTimeout(timer)
    }
    prevPowerStateRef.current = powerState
  }, [powerState])

  // Determine which meters are enabled
  const lexicalEnabled = powerState === 'on' // Lexical enabled in both text and audio modes
  const prosodicEnabled = powerState === 'on' && inputMode === 'audio' // Prosodic only in audio mode

  // Calculate display values (0 for disabled meters)
  const displayLexicalValue = lexicalEnabled ? lexicalValue : 0
  const displayProsodicValue = prosodicEnabled ? prosodicValue : 0

  // Calculate main needle value based on enabled inputs:
  // - When both inputs are enabled (audio mode): average them
  // - When only lexical is enabled (text mode): use lexical value directly
  // - When powered off: 0
  const getMainValue = (): number => {
    if (powerState !== 'on') return 0
    return prosodicEnabled ? mainValue : lexicalValue
  }
  const displayMainValue = getMainValue()

  // Determine animation duration based on state
  const needleAnimDuration =
    detectionState === DetectionState.RESETTING
      ? NEEDLE_RETURN_DURATION_MS
      : NEEDLE_ANIM_DURATION_MS

  // Level indicators animate more slowly for smoother movement
  const levelIndicatorAnimDuration =
    detectionState === DetectionState.RESETTING
      ? LEVEL_INDICATOR_RETURN_DURATION_MS
      : LEVEL_INDICATOR_ANIM_DURATION_MS

  return (
    <section
      className={`meter ${powerState === 'off' ? 'meter--off' : 'meter--on'} ${isPoweringOn ? 'meter--powering-on' : ''}`}
      data-power={powerState}
      data-input-mode={inputMode}
      data-testid="meter"
    >
      <div className="meter__title-container">
        <h1 className="meter__title">Sarcasm Detector™</h1>
        <button
          type="button"
          className="meter__info-button"
          onClick={() => setShowInfoModal(true)}
          aria-label="Open getting started guide"
        >
          <span className="meter__info-button__icon">i</span>
        </button>
      </div>

      {/* Info modal for getting started (mobile/tablet only) */}
      <MobileModal open={showInfoModal} onClose={() => setShowInfoModal(false)}>
        <GettingStarted />
      </MobileModal>

      <div className="meter__display-wrapper">
        {/* Level labels - positioned outside display to avoid filter effects */}
        <CurvedLabel
          variant="prosodic"
          label={
            <>
              Prosodic – It's <tspan className="italic">how</tspan> you say it
            </>
          }
          enabled={prosodicEnabled}
        />
        <CurvedLabel
          variant="lexical"
          label={
            <>
              Lexical – It's <tspan className="italic">what</tspan> you say
            </>
          }
          enabled={lexicalEnabled}
        />

        <div className={`meter__display ${powerState === 'on' ? 'meter__display--backlit' : ''}`}>
          {/* Scale labels */}
          <div className="meter__display__scale-labels">
            <span className="meter__display__scale-label meter__display__scale-label--left">
              No Sarcasm
            </span>
            <span className="meter__display__scale-label meter__display__scale-label--right">
              Very Sarcastic
            </span>
          </div>

          {/* SVG-based level indicators - rendered first to appear behind arcs */}
          <LevelIndicators
            prosodicValue={displayProsodicValue}
            lexicalValue={displayLexicalValue}
            prosodicEnabled={prosodicEnabled}
            lexicalEnabled={lexicalEnabled}
            isLoading={isLoading}
            isPoweringOn={isPoweringOn}
            animDuration={levelIndicatorAnimDuration}
          />

          {/* Prosodic meter (red) */}
          <Level variant="prosodic" enabled={prosodicEnabled} />

          {/* Lexical meter (orange) */}
          <Level variant="lexical" enabled={lexicalEnabled} />

          <NeedleHolder />
          <Needle
            value={displayMainValue}
            isLoading={isLoading && powerState === 'on'}
            isPoweringOn={isPoweringOn}
            animDuration={needleAnimDuration}
          />

          {/* Boundaries (visual trim) */}
          <Boundary variant="left" />
          <Boundary variant="right" />
        </div>
      </div>

      <div className="meter__controls">
        {isTabletOrMobile ? (
          <>
            <DetectionModeSwitch value={detectionMode} onChange={setDetectionMode} />
            <MobileInputControls detectionMode={detectionMode} />
          </>
        ) : (
          <RotarySwitch />
        )}
      </div>

      {/* Unreliable prediction warning */}
      {!isReliable && detectionState === DetectionState.HOLDING_RESULT && (
        <div
          className="meter__warning"
          role="alert"
          aria-live="polite"
          aria-label="Warning: The sarcasm detection result may be inaccurate because the machine learning model is currently unavailable. The displayed score is a fallback estimate."
          data-testid="meter-warning"
        >
          <WarningIcon />
          <span aria-hidden="true">Result may be inaccurate — model unavailable</span>
          {/* Screen reader gets more context via aria-label on parent */}
        </div>
      )}

      {/* Cable anchor on meter */}
      <div className="detector-jack" data-cable-anchor="meter" aria-hidden="true" />
      {/* Mobile simple cable */}
      <div
        className={`mobile-cable ${cableAnimating ? 'mobile-cable--loading' : ''}`}
        aria-hidden="true"
      />
    </section>
  )
}

type BoundaryProps = {
  variant: 'left' | 'right'
}

const Boundary = ({ variant }: BoundaryProps) => (
  <div className={`meter__display__boundary meter__display__boundary--${variant}`} />
)

type LevelProps = {
  variant: 'prosodic' | 'lexical'
  enabled: boolean
}

const Level = ({ variant, enabled }: LevelProps) => {
  return (
    <div
      className={`meter__display__level meter__display__level--${variant} ${enabled ? '' : 'meter__display__level--disabled'}`}
      data-enabled={enabled}
    >
      <div className={`meter__display__ticks__wrapper meter__display__ticks__wrapper--${variant}`}>
        <Ticks ticks={TICKS} />
      </div>
    </div>
  )
}

type CurvedLabelProps = {
  variant: 'prosodic' | 'lexical'
  label: React.ReactNode
  enabled: boolean
}

const CurvedLabel = ({ variant, label, enabled }: CurvedLabelProps) => {
  const pathId = `curve-${variant}`

  return (
    <svg
      className={`meter__curved-label meter__curved-label--${variant} ${enabled ? '' : 'meter__curved-label--disabled'}`}
      viewBox="0 0 240 45"
      preserveAspectRatio="xMidYMax meet"
    >
      <defs>
        <path id={pathId} d="M 8,38 Q 120,5 232,38" fill="none" />
      </defs>
      <text className="meter__curved-label__text">
        <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
          {label}
        </textPath>
      </text>
    </svg>
  )
}

type TicksProps = {
  ticks: Tick[]
}

const Ticks = ({ ticks }: TicksProps) => (
  <>
    {ticks.map(tick => (
      <TickMark key={tick.uuid} size={tick.size} rotation={tick.rotation} label={tick.label} />
    ))}
  </>
)

type TickProps = Omit<Tick, 'uuid'>
const TickMark = ({ size, rotation, label }: TickProps) => {
  return (
    <div
      className={`meter__tick meter__tick--${size}`}
      style={{ transform: `rotate(${rotation}deg)` }}
      title={label}
    />
  )
}

const NeedleHolder = () => <div className="meter__needle__holder" />

const WarningIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

type NeedleProps = {
  value: number
  isLoading: boolean
  isPoweringOn: boolean
  animDuration: number
}

const Needle = ({ value, isLoading, isPoweringOn, animDuration }: NeedleProps) => {
  // Convert value (0-1) to rotation degrees to stay within visible arc
  // NEEDLE_MIN_DEG = leftmost (0), 0deg = center (0.5), NEEDLE_MAX_DEG = rightmost (1)
  const rotation = NEEDLE_MIN_DEG + value * NEEDLE_RANGE_DEG

  return (
    <div
      className={`meter__needle ${isLoading ? 'meter__needle--loading' : ''} ${isPoweringOn ? 'meter__needle--powering-on' : ''}`}
      style={
        {
          '--needle-rotation': `${rotation}deg`,
          '--anim-duration': `${animDuration}ms`,
        } as React.CSSProperties
      }
    />
  )
}

export default MeterSection
