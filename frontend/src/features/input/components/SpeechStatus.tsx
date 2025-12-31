import { MEDIA_QUERIES } from '../../../breakpoints'
import { useMediaQuery } from '../hooks'
import type { SpeechStatus as SpeechStatusType } from '../hooks/speech'
import { isMobileBrowser } from '../utils'
import { isDev } from '../utils/env'

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

/**
 * Get the current model name for display
 */
function getCurrentModelName(): string {
  // In dev mode, check for model override
  if (isDev()) {
    const override = localStorage.getItem('moonshine_model_override')
    if (override) {
      return override.replace('model/', '')
    }
  }

  // Fall back to env variable
  const envModel = import.meta.env.VITE_MOONSHINE_MODEL
  if (envModel && typeof envModel === 'string') {
    return envModel.replace('model/', '')
  }

  return 'base'
}

/**
 * Get model size for display
 */
function getModelSize(modelName: string): string {
  const sizes: Record<string, string> = {
    tiny: '190MB',
    base: '400MB',
  }
  return sizes[modelName] || '~400MB'
}

/**
 * Retro loading spinner component matching the VU meter aesthetic
 */
function RetroSpinner() {
  return (
    <svg
      className="retro-spinner"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle
        cx="10"
        cy="10"
        r="8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="25 15"
        opacity="0.6"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 10 10"
          to="360 10 10"
          dur="1.5s"
          repeatCount="indefinite"
        />
      </circle>
      <circle
        cx="10"
        cy="10"
        r="4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.4"
      >
        <animate attributeName="r" values="3;5;3" dur="1.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.4;0.8;0.4" dur="1.5s" repeatCount="indefinite" />
      </circle>
    </svg>
  )
}

const STATUS_CONFIG: Record<'loading' | 'error', StatusConfig> = {
  loading: {
    message: (() => {
      const modelName = getCurrentModelName()
      const modelSize = getModelSize(modelName)
      return `Loading ${modelName} model (${modelSize})... This may take a moment on first load.`
    })(),
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
  const isMobileOrTablet = useMediaQuery(MEDIA_QUERIES.isMobileOrTablet)
  const isMobile = isMobileBrowser()
  // Always render a container, but behavior differs by platform:
  // - Desktop: Reserves space (minHeight) to prevent layout shifts
  // - Mobile: Overlay positioning (no reserved space) to save room
  // Show errors on all platforms (critical feedback users need to see)
  // Loading state is mobile-only to prevent layout shifts on desktop
  // In dev mode, allow showing loading spinner even when not recording (for testing)
  const isError = status === 'error'
  const isLoading = status === 'loading'
  const shouldShowError = isRecording && isError
  const shouldShowLoading = isMobile && ((isRecording && isLoading) || (isDev() && isLoading))
  const shouldShow = shouldShowError || shouldShowLoading
  const config = shouldShow && (isLoading || isError) ? STATUS_CONFIG[status] : null

  return (
    <output
      className="speech-status speech-status--container"
      aria-live="polite"
      aria-atomic="true"
      data-testid="speech-status"
      style={{
        // Desktop: Reserve space even when hidden to prevent layout shifts
        // Mobile: CSS handles fixed positioning, so no inline styles needed
        minHeight: isMobileOrTablet ? undefined : '1.5rem',
        padding: shouldShow ? undefined : '0',
      }}
    >
      {shouldShow && config && (
        <div className={`speech-status speech-status--${config.variant}`}>
          <span className="speech-status__icon" aria-hidden="true">
            {status === 'loading' ? <RetroSpinner /> : config.icon}
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
      )}
    </output>
  )
}

export default SpeechStatus
