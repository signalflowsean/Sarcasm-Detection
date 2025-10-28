import { TICKS } from "./utils";
import type { Tick } from "./types";
import RotarySwitch from './components/RotarySwitch'

const MeterSection = () => {
  return (
    <div className="meter">
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
    </div>
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
