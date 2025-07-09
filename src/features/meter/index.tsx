type Tick = {
  position: number; // Position along the arc (0-100%)
  size: "small" | "large";
  label?: string; // Optional label for the tick
};

const TICKS: Tick[] = [
  { position: 1, size: "large" },
  { position: 10, size: "small" },
  { position: 20, size: "large" },
  { position: 30, size: "small" },
  { position: 40, size: "large" },
  { position: 50, size: "small" },
  { position: 60, size: "large" },
  { position: 70, size: "small" },
  { position: 80, size: "large" },
  { position: 90, size: "small" },
  { position: 100, size: "large" },
];

const MeterSection = () => {
  return (
    <div className="meter">
      <div className="meter__display">
        <Boundary varient="left" />
        <Boundary varient="right" />
        <Level varient="prosodic" />
        <Level varient="lexical" />
      </div>
      <div className="meter__controls"></div>
    </div>
  );
};

type BoundaryProps = {
  varient: "left" | "right";
};

const Boundary = ({ varient }: BoundaryProps) => {
  return (
    <div
      className={`meter__display__boundary meter__display__boundary--${varient}`}
    />
  );
};

type LevelProps = {
  varient: "prosodic" | "lexical";
};

const Level = ({ varient }: LevelProps) => {
  return (
    <div className={`meter__display__level meter__display__level--${varient}`}>
      <Ticks ticks={TICKS} variant={varient} />
    </div>
  );
};

type TicksProps = {
  ticks: Tick[];
  variant: "prosodic" | "lexical";
};

const Ticks = ({ ticks, variant }: TicksProps) => {
  return (
    <>
      {ticks.map((tick, index) => (
        <Tick
          key={`${variant}-tick-${index}`}
          size={tick.size}
          position={tick.position}
          label={tick.label}
        />
      ))}
    </>
  );
};

// Updated Tick component to handle optional label
type TickProps = {
  size: "small" | "large";
  position: number;
  label?: string;
};

const Tick = ({ size, position, label }: TickProps) => {
  return (
    <div
      className={`meter__tick meter__tick--${size}`}
      style={{ "--tick-position": `${position}%` } as React.CSSProperties}
      title={label} // Optional tooltip
    />
  );
};

export default MeterSection;
