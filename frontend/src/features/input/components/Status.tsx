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
    <div
      className={statusClass}
      role="status"
      style={{ visibility: shouldShow ? 'visible' : 'hidden' }}
    >
      {statusText}
      <span className="audio-recorder__status__duration">{duration}</span>
    </div>
  )
}

export default Status
