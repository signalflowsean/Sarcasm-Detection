type Props = {
  canPlay: boolean
  isPlaying: boolean
  onTogglePlay: () => void
  onDiscard: () => void
  canDiscard: boolean
  onSend: () => void
  canSend: boolean
  sending: boolean
}

const Controls = ({ canPlay, isPlaying, onTogglePlay, onDiscard, canDiscard, onSend, canSend, sending }: Props) => {
  let sendLabel = 'Send to Detector'
  if (!canSend) {
    sendLabel = 'Click microphone to start recording'
  } else if (sending) {
    sendLabel = 'Sending…'
  }

  const playLabel = isPlaying ? 'Pause' : 'Preview Audio'

  return (
    <div className="audio-recorder__controls">
      <button
        type="button"
        className="audio-btn"
        onClick={onTogglePlay}
        disabled={!canPlay}
        aria-label={playLabel}
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
        <span aria-hidden="true">🗑</span>
      </button>
      <button
        type="button"
        className="audio-btn audio-btn--primary"
        onClick={onSend}
        disabled={!canSend || sending}
        aria-label={sendLabel}
      >
        {sendLabel}
      </button>
    </div>
  )
}

export default Controls


