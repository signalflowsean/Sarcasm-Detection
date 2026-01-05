import { AUTO_STOP_COUNTDOWN_START_MS, SPEECH_LOADING_DEFAULT_MESSAGE } from '../hooks/constants'
import type { SpeechStatus } from '../hooks/speech'

type Props = {
  isRecording: boolean
  isPlaying: boolean
  hasAudio: boolean
  duration: string
  autoStopCountdown: number | null
  speechStatus?: SpeechStatus
}

const Status = ({
  isRecording,
  isPlaying,
  hasAudio,
  duration,
  autoStopCountdown,
  speechStatus,
}: Props) => {
  const isLoading = speechStatus === 'loading'
  const shouldShow = isRecording || hasAudio

  let statusText = ''
  let statusClass = 'audio-recorder__status'

  // Show countdown if we're in the auto-stop countdown window
  const showCountdown =
    isRecording &&
    !isLoading &&
    autoStopCountdown !== null &&
    autoStopCountdown > 0 &&
    autoStopCountdown <= AUTO_STOP_COUNTDOWN_START_MS

  if (isRecording) {
    if (isLoading) {
      statusText = SPEECH_LOADING_DEFAULT_MESSAGE
      statusClass += ' audio-recorder__status--loading'
    } else if (showCountdown) {
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
          {!showCountdown && !isLoading && (
            <span className="audio-recorder__status__duration">{duration}</span>
          )}
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
