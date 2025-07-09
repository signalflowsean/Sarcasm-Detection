type Tick = {
  size: "small" | "large";
  label?: string; // Optional label for the tick
};

const TICKS: Tick[] = [
  { size: "large" },
  { size: "small" },
  { size: "large" },
  { size: "small" },
  { size: "large" },
  { size: "small" },
  { size: "large" },
  { size: "small" },
  { size: "large" },
  { size: "small" },
  { size: "large" },
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
    <div className={`meter__display__level meter__display__level--${varient}`} >
      <div className={`meter__display__ticks__wrapper meter__display__ticks__wrapper--${varient}`}>
        <Ticks ticks={TICKS} variant={varient} />
      </div>
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
          label={tick.label}
        />
      ))}
    </>
  );
};

// Updated Tick component to handle optional label
type TickProps = {
  size: "small" | "large";
  label?: string;
};

const Tick = ({ size, label }: TickProps) => {
  return (
    <div
      className={`meter__tick meter__tick--${size}`}
      title={label} // Optional tooltip
    />
  );
};

export default MeterSection;
