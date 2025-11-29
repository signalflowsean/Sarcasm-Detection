import { TICKS } from "./utils";
import type { Tick } from "./types";
import RotarySwitch from './components/RotarySwitch'
import FirstTimeOverlay from './components/FirstTimeOverlay'

const MeterSection = () => {
  return (
    <section className="meter">
      <h1 className="meter__title">Sarcasm Detector™</h1>
      {/* Portal target for mobile launcher button */}
      <div id="mobile-launcher-portal" className="mobile-launcher-portal" />
      <FirstTimeOverlay />
      <div className="meter__display">
        {/* TODO: Put boundaries in a meter__display__boundaries__wrapper */}
        <Boundary variant="left" />
        <Boundary variant="right" />
        <Level variant="prosodic" />
        <Level variant="lexical" />
        <NeedleHolder />
        <Needle />
      </div>
      <div className="meter__controls">
        <RotarySwitch />
      </div>
      {/* Cable anchor on meter */}
      <div className="detector-jack" data-cable-anchor="meter" aria-hidden="true" />
      {/* Mobile simple cable */}
      <div className="mobile-cable" aria-hidden="true" />
    </section>
  )
}

type BoundaryProps = {
  variant: "left" | "right";
}

const Boundary = ({ variant }: BoundaryProps) => (
  <div
    className={`meter__display__boundary meter__display__boundary--${variant}`}
  />
)

type LevelProps = {
  variant: "prosodic" | "lexical";
}

const Level = ({ variant }: LevelProps) => (
  <div className={`meter__display__level meter__display__level--${variant}`}>
    <div
      className={`meter__display__ticks__wrapper meter__display__ticks__wrapper--${variant}`}
    >
      <Ticks ticks={TICKS} />
    </div>
  </div>
)

type TicksProps = {
  ticks: Tick[];
}

const Ticks = ({ ticks }: TicksProps) =>
  <>
    {ticks.map((tick) => (
      <Tick
        key={tick.uuid}
        size={tick.size}
        rotation={tick.rotation}
        label={tick.label} // Optional label for tooltip
      />
    ))}
  </>

type TickProps = Omit<Tick, 'uuid'>;
const Tick = ({ size, rotation, label }: TickProps) => {
  return (
    <div
      className={`meter__tick meter__tick--${size}`}
      style={{ transform: `rotate(${rotation}deg)` }}
      title={label} // Optional tooltip
    />
  )
}

const NeedleHolder = () => (
  <div className="meter__needle__holder" />
)

const Needle = () => (
  <div className="meter__needle" />
)

export default MeterSection
