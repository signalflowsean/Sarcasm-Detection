type Props = {
  isRecording: boolean
  duration: string
}

const Status = ({ isRecording, duration }: Props) => {
  return (
    <div className="audio-recorder__status" role="status">
      {isRecording && 'Recording… '} {duration}
    </div>
  )
}

export default Status


