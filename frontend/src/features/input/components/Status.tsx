import { AUTO_STOP_COUNTDOWN_START_MS } from '../hooks/constants'

type Props = {
  isRecording: boolean
  isPlaying: boolean
  hasAudio: boolean
  duration: string
  autoStopCountdown: number | null
}

const Status = ({ isRecording, isPlaying, hasAudio, duration, autoStopCountdown }: Props) => {
  const shouldShow = isRecording || hasAudio

  let statusText = ''
  let statusClass = 'audio-recorder__status'

  // Show countdown if we're in the auto-stop countdown window
  const showCountdown =
    isRecording &&
    autoStopCountdown !== null &&
    autoStopCountdown > 0 &&
    autoStopCountdown <= AUTO_STOP_COUNTDOWN_START_MS

  if (isRecording) {
    if (showCountdown) {
      const secondsRemaining = Math.ceil(autoStopCountdown / 1000)
      statusText = `Auto-stopping recording in ${secondsRemaining}… `
      statusClass += ' audio-recorder__status--countdown'
    } else {
      statusText = 'Recording… '
    }
  } else if (isPlaying) {
    statusText = 'Playing… '
  } else if (hasAudio) {
    statusText = '✓ Ready to Send '
    statusClass += ' audio-recorder__status--ready'
  }

  return (
    <output
      className={statusClass}
      style={{
        visibility: shouldShow ? 'visible' : 'hidden',
        // Reserve space even when hidden to prevent layout shifts
        minHeight: '1.5rem',
      }}
    >
      {shouldShow ? (
        <>
          {statusText}
          {!showCountdown && <span className="audio-recorder__status__duration">{duration}</span>}
        </>
      ) : (
        // Render invisible placeholder to maintain consistent height
        <span aria-hidden="true" style={{ opacity: 0 }}>
          Recording… 0:00
        </span>
      )}
    </output>
  )
}

export default Status
