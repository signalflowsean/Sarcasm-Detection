/**
 * Moonshine Preload Status Component
 *
 * Shows download progress for Moonshine model at the app level.
 * Only visible when Moonshine is needed (Web Speech API not available)
 * and the model is still being downloaded.
 */

import { SPEECH_LOADING_MESSAGE } from '../hooks/constants'
import { useMoonshinePreload } from '../hooks/useMoonshinePreload'
import { formatBytes } from '../utils/format'
import { RetroSpinner } from './RetroSpinner'

/**
 * App-level Moonshine preload status indicator.
 * Shows in top-right corner when model is downloading.
 */
export function MoonshinePreloadStatus() {
  const { isLoading, isComplete, progress, needsMoonshine } = useMoonshinePreload()

  // Don't show if:
  // - Web Speech API is available (no Moonshine needed)
  // - Preload is complete
  // - Not currently loading
  if (!needsMoonshine || isComplete || !isLoading) {
    return null
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
      className="speech-status speech-status--container"
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
