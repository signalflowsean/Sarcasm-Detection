import type { CSSProperties } from 'react';

const MeterSection = () => {
  return (
    <div className="meter">
      <div className="meter__display">
        <MeterBoundary columnStart={1} rotate="-20deg" className="meter__display__boundary--1" />
        <MeterBoundary columnStart={3} rotate="20deg" className="meter__display__boundary--2" />
        <div className="meter__display__level" />
        <div className="meter__display__level" />
      </div>
      <div className="meter__controls"></div>
    </div>
  )
}

type MeterBoundaryProps = {
  columnStart: number;
  rotate: string;
  className?: string;
}

const MeterBoundary = ({ columnStart, rotate, className } : MeterBoundaryProps ) => {
  return (
    <div
      className={`meter__display__boundary ${className}`}
      style={
        {
          "--column-start" : columnStart,
          "--boundary-rotate" : rotate
        } as CSSProperties
      }
    />
  );
}

export default MeterSection;