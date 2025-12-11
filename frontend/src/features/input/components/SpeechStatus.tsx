import type { SpeechStatus as SpeechStatusType } from '../hooks/useSpeechRecognition'

type Props = {
  status: SpeechStatusType
  isRecording: boolean
  onDismiss?: () => void
}

type StatusConfig = {
  message: string
  srPrefix: string // Screen reader prefix for context
  icon: string
  variant: 'info' | 'error'
}

const STATUS_CONFIG: Record<'loading' | 'error', StatusConfig> = {
  loading: {
    message: 'Loading speech recognition model... (first time only)',
    srPrefix: 'Info:',
    icon: '⏳',
    variant: 'info',
  },
  error: {
    message: 'Speech-to-text encountered an error. Your audio is still being recorded.',
    srPrefix: 'Error:',
    icon: '✕',
    variant: 'error',
  },
}

/**
 * Accessible status indicator for speech recognition.
 * Shows loading state during model download or errors.
 *
 * Accessibility features:
 * - aria-live="polite" announces status changes without interrupting
 * - Visually hidden prefix provides context for screen readers
 * - Icons are decorative (aria-hidden) with text alternatives in message
 * - Actionable messages reassure users their audio is still recording
 */
const SpeechStatus = ({ status, isRecording, onDismiss }: Props) => {
  // Only show status indicator during recording and when there's something to show
  if (!isRecording) return null
  if (status === 'idle' || status === 'listening') return null

  const config = STATUS_CONFIG[status]
  if (!config) return null

  const className = `speech-status speech-status--${config.variant}`

  return (
    <div
      className={className}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="speech-status"
    >
      <span className="speech-status__icon" aria-hidden="true">
        {config.icon}
      </span>
      <span className="speech-status__message">
        {/* Visually hidden prefix for screen readers */}
        <span className="sr-only">{config.srPrefix} </span>
        {config.message}
      </span>
      {onDismiss && (
        <button
          type="button"
          className="speech-status__dismiss"
          onClick={onDismiss}
          aria-label="Dismiss message"
        >
          <span aria-hidden="true">✕</span>
        </button>
      )}
    </div>
  )
}

export default SpeechStatus
