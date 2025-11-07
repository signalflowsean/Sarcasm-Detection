import { forwardRef } from 'react'

type Props = {
  isRecording: boolean
  disabled?: boolean
  onClick: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
}

const MicButton = forwardRef<HTMLButtonElement, Props>(function MicButton({ isRecording, disabled, onClick, onKeyDown }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={`audio-recorder__mic ${isRecording ? 'is-recording' : ''}`}
      aria-label={isRecording ? 'Stop recording' : 'Start recording'}
      aria-pressed={isRecording}
      disabled={disabled}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      <span className="audio-recorder__mic__glyph" aria-hidden="true">🎤</span>
      <span className="audio-recorder__mic__power" aria-hidden="true" />
    </button>
  )
})

export default MicButton


