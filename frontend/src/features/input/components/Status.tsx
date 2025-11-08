type Props = {
  isRecording: boolean
  isPlaying: boolean
  hasAudio: boolean
  duration: string
}

const Status = ({ isRecording, isPlaying, hasAudio, duration }: Props) => {
  const shouldShow = isRecording || hasAudio
  
  let statusText = ''
  if (isRecording) {
    statusText = 'Recording… '
  } else if (isPlaying) {
    statusText = 'Playing… '
  } else if (hasAudio) {
    statusText = 'Paused… '
  }
  
  return (
    <div 
      className="audio-recorder__status" 
      role="status"
      style={{ visibility: shouldShow ? 'visible' : 'hidden' }}
    >
      {statusText}{duration}
    </div>
  )
}

export default Status


