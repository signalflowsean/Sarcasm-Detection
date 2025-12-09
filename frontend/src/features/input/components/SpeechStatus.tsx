import type { SpeechStatus as SpeechStatusType } from '../hooks/useSpeechRecognition'

type Props = {
  status: SpeechStatusType
  isRecording: boolean
  onDismiss?: () => void
}

/**
 * Visual indicator for speech recognition status.
 * Shows warnings when speech-to-text is having issues on mobile.
 */
const SpeechStatus = ({ status, isRecording, onDismiss }: Props) => {
  // Only show status indicator during recording and when there's something to show
  if (!isRecording) return null
  if (status === 'idle' || status === 'listening') return null

  let message = ''
  let icon = ''
  let className = 'speech-status'

  switch (status) {
    case 'unsupported':
      message = 'Speech-to-text not available in this browser'
      icon = '⚠'
      className += ' speech-status--warning'
      break
    case 'degraded':
      message = 'Speech-to-text may not be working. Audio is still recording.'
      icon = '⚠'
      className += ' speech-status--warning'
      break
    case 'error':
      message = 'Speech-to-text unavailable'
      icon = '✕'
      className += ' speech-status--error'
      break
    default:
      return null
  }

  return (
    <div className={className} role="alert" data-testid="speech-status">
      <span className="speech-status__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="speech-status__message">{message}</span>
      {onDismiss && (
        <button
          type="button"
          className="speech-status__dismiss"
          onClick={onDismiss}
          aria-label="Dismiss speech status message"
        >
          ✕
        </button>
      )}
    </div>
  )
}
export default SpeechStatus
