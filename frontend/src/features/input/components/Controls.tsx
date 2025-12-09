import { isMacPlatform } from '../utils'

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

const Controls = ({
  canPlay,
  isPlaying,
  onTogglePlay,
  onDiscard,
  canDiscard,
  onSend,
  canSend,
  sending,
  isRecording,
}: Props) => {
  let sendLabel = 'Send to Detector'
  if (!canSend) {
    sendLabel = 'Record Audio First'
  } else if (sending) {
    sendLabel = 'Sending…'
  }

  const playLabel = isPlaying ? 'Pause' : 'Preview Audio'

  // Detect platform for keyboard shortcut display
  const isMac = isMacPlatform()
  const modifierKey = isMac ? '⌘' : 'Ctrl'

  // Flash the send button when audio is ready but not recording/playing/sending
  const shouldFlash = canSend && !isPlaying && !sending && !isRecording

  return (
    <div className="audio-recorder__controls" data-testid="audio-controls">
      <button
        type="button"
        className={`audio-btn ${canPlay ? 'audio-btn--with-shortcut' : ''}`}
        onClick={onTogglePlay}
        disabled={!canPlay}
        data-testid="play-button"
      >
        <span className="audio-btn__label">{playLabel}</span>
        {canPlay && (
          <kbd className="audio-btn__shortcut" aria-label="Keyboard shortcut: Space">
            Space
          </kbd>
        )}
      </button>
      <button
        type="button"
        className={`audio-btn audio-btn--danger ${canDiscard ? 'audio-btn--with-shortcut' : ''}`}
        onClick={onDiscard}
        disabled={!canDiscard}
        aria-label="Discard recording"
        data-testid="discard-button"
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
        {canDiscard && (
          <kbd className="audio-btn__shortcut" aria-label="Keyboard shortcut: Delete">
            Del
          </kbd>
        )}
      </button>
      <button
        type="button"
        className={`audio-btn audio-btn--primary ${canSend && !sending ? 'audio-btn--with-shortcut' : ''} ${shouldFlash ? 'audio-btn--flash' : ''}`}
        onClick={onSend}
        disabled={!canSend || sending}
        data-testid="send-button"
      >
        <span className="audio-btn__label">{sendLabel}</span>
        {canSend && !sending && (
          <kbd
            className="audio-btn__shortcut"
            aria-label={`Keyboard shortcut: ${modifierKey} + Enter`}
          >
            {modifierKey}+↵
          </kbd>
        )}
      </button>
    </div>
  )
}

export default Controls
