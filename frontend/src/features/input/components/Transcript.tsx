type Props = {
  supported: boolean
  transcript: string
  interim: string
}

const Transcript = ({ supported, transcript, interim }: Props) => {
  let text = 'Speak to transcribe…'
  if (!supported) {
    text = 'Speech-to-text not supported in this browser.'
  } else {
    const combined = (transcript + ' ' + interim).trim()
    if (combined) text = combined
  }
  return (
    <div className="audio-recorder__transcript">
      <p>{text}</p>
    </div>
  )
}

export default Transcript
