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
      <svg 
        className="audio-recorder__mic__glyph" 
        aria-hidden="true"
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      >
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" x2="12" y1="19" y2="22" />
      </svg>
      <span className="audio-recorder__mic__power" aria-hidden="true" />
    </button>
  )
})

export default MicButton


