/**
 * Moonshine Preload Status Component
 *
 * Shows download progress for Moonshine model at the app level.
 * Only visible when Moonshine is needed (Web Speech API not available)
 * and the model is still being downloaded or has failed.
 */

import { SPEECH_LOADING_MESSAGE } from '../hooks/constants'
import { useMoonshinePreload } from '../hooks/useMoonshinePreload'
import { formatBytes } from '../utils/format'
import { RetroSpinner } from './RetroSpinner'

/**
 * App-level Moonshine preload status indicator.
 * Shows in top-right corner when model is downloading or has failed.
 */
export function MoonshinePreloadStatus() {
  const { isLoading, isComplete, hasError, progress, needsMoonshine, retry } = useMoonshinePreload()

  // Don't show if:
  // - Web Speech API is available (no Moonshine needed)
  // - Preload is complete
  // - Not loading AND not in error state
  if (!needsMoonshine || isComplete || (!isLoading && !hasError)) {
    return null
  }

  // Show error state with retry option
  if (hasError) {
    return (
      <output
        className="speech-status--container"
        aria-live="polite"
        aria-atomic="true"
        data-testid="moonshine-preload-status"
      >
        <div className="speech-status speech-status--preload-error">
          <span className="speech-status__message">
            <span className="sr-only">Error: </span>
            Speech model failed to load
          </span>
          <button
            type="button"
            className="speech-status__retry-button"
            onClick={retry}
            aria-label="Retry loading speech model"
          >
            Retry
          </button>
        </div>
      </output>
    )
  }

  // Generate loading message with progress if available
  const getMessage = () => {
    if (!progress || progress.percent === 0) {
      return SPEECH_LOADING_MESSAGE
    }
    if (progress.percent >= 100) {
      return 'Initializing Speech Recognition...'
    }
    // Show progress percentage and size
    const downloaded = formatBytes(progress.bytesDownloaded)
    const total = formatBytes(progress.totalBytes)
    return `${SPEECH_LOADING_MESSAGE} (${progress.percent}% • ${downloaded}/${total})`
  }

  return (
    <output
      className="speech-status--container"
      aria-live="polite"
      aria-atomic="true"
      data-testid="moonshine-preload-status"
    >
      <div className="speech-status speech-status--info">
        <span className="speech-status__message">
          <span className="sr-only">Info: </span>
          {getMessage()}
        </span>
        {/* Progress bar */}
        {progress && progress.percent > 0 && progress.percent < 100 && (
          <div className="speech-status__progress" aria-hidden="true">
            <div
              className="speech-status__progress-bar"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        )}
        <span className="speech-status__icon" aria-hidden="true">
          <RetroSpinner />
        </span>
      </div>
    </output>
  )
}

export default MoonshinePreloadStatus
