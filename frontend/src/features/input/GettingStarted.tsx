import { useMediaQuery } from './hooks'
import { MEDIA_QUERIES } from '../../breakpoints'

const GettingStarted = () => {
  const isDesktop = useMediaQuery(MEDIA_QUERIES.isDesktop)

  return (
    <div className="getting-started" data-testid="getting-started">
      <h2 className="getting-started__title">Welcome to the State-of-the-Art Sarcasm Detector™</h2>
      {isDesktop && (
        <p className="getting-started__intro">
          Start by selecting a mode by turning the rotary knob to the right.
        </p>
      )}
      <p className="getting-started__description">
        This device uses two machine learning models to determine whether someone's being seriously
        serious… or just dripping with sarcasm.
      </p>
      <ul className="getting-started__models">
        <li className="getting-started__model">
          <strong>The Lexical Model</strong> analyzes the actual words you use.
        </li>
        <li className="getting-started__model">
          <strong>The Prosodic Model</strong> listens for tone, pitch, and rhythm — because
          sometimes it's not what you say, it's how you say it.
        </li>
      </ul>
      <p className="getting-started__cta">
        So go ahead — say something clever, dry, or dangerously witty — and let the Sarcasm Detector
        decide whether you're joking or a genius.
      </p>
    </div>
  )
}

export default GettingStarted
