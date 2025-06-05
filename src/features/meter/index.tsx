import type { CSSProperties } from 'react';

const MeterSection = () => {
  return (
    <div className="meter">
      <div className="meter__display">
        <MeterBoundary columnStart={1} rotate="-20deg" />
        <MeterBoundary columnStart={3} rotate="20deg" />
        <div className="meter__display__level" />
      </div>
      <div className="meter__controls"></div>
    </div>
  )
}

type MeterBoundaryProps = {
  columnStart: number;
  rotate: string;
}

const MeterBoundary = ({ columnStart, rotate } : MeterBoundaryProps ) => {
  return (
    <div
      className="meter__display__boundary"
      style={
        {
          "--column-start": columnStart,
          "--boundary-rotate" : rotate
        } as CSSProperties
      }
    />
  );
}

export default MeterSection;