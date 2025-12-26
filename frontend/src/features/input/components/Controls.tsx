import { isMacPlatform, isMobileBrowser } from '../utils'
import DiscardButton from './DiscardButton'
import PlayButton from './PlayButton'

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
  const sendLabel = sending ? 'Sending...' : canSend ? 'Send to Detector' : 'Record Audio First'

  // Detect platform for keyboard shortcut display
  const isMac = isMacPlatform()
  const modifierKey = isMac ? '⌘' : 'Ctrl'
  const isMobile = isMobileBrowser()

  // Flash the send button when audio is ready but not recording/playing/sending
  const shouldFlash = canSend && !isPlaying && !sending && !isRecording

  return (
    <div className="audio-recorder__controls" data-testid="audio-controls">
      <PlayButton
        onClick={onTogglePlay}
        disabled={!canPlay}
        isPlaying={isPlaying}
        canPlay={canPlay}
        className={`audio-btn ${canPlay && !isMobile ? 'audio-btn--with-shortcut' : ''}`}
        labelClassName="audio-btn__label"
        shortcutClassName="audio-btn__shortcut"
        showLabel={true}
        playLabel="Preview Audio"
        pauseLabel="Pause"
      />
      <DiscardButton
        onClick={onDiscard}
        disabled={!canDiscard}
        canDiscard={canDiscard}
        className={`audio-btn audio-btn--danger ${canDiscard && !isMobile ? 'audio-btn--with-shortcut' : ''}`}
        shortcutClassName="audio-btn__shortcut"
        testId="discard-button"
      />
      <button
        type="button"
        className={`audio-btn audio-btn--primary ${canSend && !sending && !isMobile ? 'audio-btn--with-shortcut' : ''} ${shouldFlash ? 'audio-btn--flash' : ''}`}
        onClick={onSend}
        disabled={!canSend || sending}
        data-testid="send-button"
      >
        <span className="audio-btn__label">{sendLabel}</span>
        {canSend && !sending && !isMobile && (
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
