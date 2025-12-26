type Props = {
  isRecording: boolean
  isPlaying: boolean
  hasAudio: boolean
  duration: string
}

const Status = ({ isRecording, isPlaying, hasAudio, duration }: Props) => {
  const shouldShow = isRecording || hasAudio

  let statusText = ''
  let statusClass = 'audio-recorder__status'

  if (isRecording) {
    statusText = 'Recording… '
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
          <span className="audio-recorder__status__duration">{duration}</span>
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
