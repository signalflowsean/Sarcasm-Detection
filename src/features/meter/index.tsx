const MeterSection = () => {
  return (
    <div className="meter">
      <div className="meter__display">
        <MeterBoundary varient="left" />
        <MeterBoundary varient="right" />
        <section className="meter__display__level" />
        <section className="meter__display__level" />
      </div>
      <div className="meter__controls"></div>
    </div>
  )
}

type MeterBoundaryProps = {
  varient: 'left' | 'right';
}

const MeterBoundary = ({ varient } : MeterBoundaryProps ) => {
  return (
    <div
      className={`meter__display__boundary meter__display__boundary--${varient}`}
    />
  );
}

export default MeterSection;