import { SPEECH_LOADING_MESSAGE } from '../hooks/constants'
import type { SpeechStatus as SpeechStatusType } from '../hooks/speech'
import { RetroSpinner } from './RetroSpinner'

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
    message: SPEECH_LOADING_MESSAGE,
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
 * Accessible status indicator for speech recognition during active recording.
 * Shows loading state or errors. Progress is handled by MoonshinePreloadStatus.
 *
 * Accessibility features:
 * - aria-live="polite" announces status changes without interrupting
 * - Visually hidden prefix provides context for screen readers
 * - Icons are decorative (aria-hidden) with text alternatives in message
 * - Actionable messages reassure users their audio is still recording
 */
const SpeechStatus = ({ status, isRecording, onDismiss }: Props) => {
  // Show loading and error states on both mobile and desktop
  const isError = status === 'error'
  const isLoading = status === 'loading'
  const shouldShowError = isRecording && isError
  // Show loading when status is 'loading' during recording
  const shouldShowLoading = isLoading && isRecording
  const shouldShow = shouldShowError || shouldShowLoading
  const config = shouldShow && (isLoading || isError) ? STATUS_CONFIG[status] : null

  return (
    <output
      className="speech-status speech-status--container"
      aria-live="polite"
      aria-atomic="true"
      data-testid="speech-status"
    >
      {shouldShow && config && (
        <div className={`speech-status speech-status--${config.variant}`}>
          {/* Text first, then icon (spinner in top-right corner) */}
          <span className="speech-status__message">
            {/* Visually hidden prefix for screen readers */}
            <span className="sr-only">{config.srPrefix} </span>
            {config.message}
          </span>
          <span className="speech-status__icon" aria-hidden="true">
            {status === 'loading' ? <RetroSpinner /> : config.icon}
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
      )}
    </output>
  )
}

export default SpeechStatus
