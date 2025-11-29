type Props = {
  canPlay: boolean
  isPlaying: boolean
  onTogglePlay: () => void
  onDiscard: () => void
  canDiscard: boolean
  onSend: () => void
  canSend: boolean
  sending: boolean
  isRecording: boolean
}

const Controls = ({ canPlay, isPlaying, onTogglePlay, onDiscard, canDiscard, onSend, canSend, sending, isRecording }: Props) => {
  let sendLabel = 'Send to Detector'
  if (!canSend) {
    sendLabel = 'Record audio first'
  } else if (sending) {
    sendLabel = 'Sending…'
  }

  const playLabel = isPlaying ? 'Pause' : 'Preview Audio'
  
  // Flash the send button when audio is ready but not recording/playing/sending
  const shouldFlash = canSend && !isPlaying && !sending && !isRecording

  return (
    <div className="audio-recorder__controls">
      <button
        type="button"
        className="audio-btn"
        onClick={onTogglePlay}
        disabled={!canPlay}
      >
        {playLabel}
      </button>
      <button
        type="button"
        className="audio-btn audio-btn--danger"
        onClick={onDiscard}
        disabled={!canDiscard}
        aria-label="Discard recording"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          width="20"
          height="20"
        >
          <path d="M3 6h18" />
          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        </svg>
      </button>
      <button
        type="button"
        className={`audio-btn audio-btn--primary ${shouldFlash ? 'audio-btn--flash' : ''}`}
        onClick={onSend}
        disabled={!canSend || sending}
      >
        {sendLabel}
      </button>
    </div>
  )
}

export default Controls


