type Props = {
  onClick: () => void
  disabled?: boolean
  isPlaying: boolean
  canPlay?: boolean
  className?: string
  labelClassName?: string
  shortcutClassName?: string
  testId?: string
  'aria-label'?: string
  /**
   * Show text label (for desktop layout)
   * If false, shows icon only (for mobile layout)
   */
  showLabel?: boolean
  playLabel?: string
  pauseLabel?: string
}

/**
 * Shared play/pause button component.
 * Used in both desktop (Controls) and mobile (MobileInputControls) layouts.
 */
const PlayButton = ({
  onClick,
  disabled = false,
  isPlaying,
  canPlay = false,
  className = '',
  labelClassName = '',
  shortcutClassName = '',
  testId = 'play-button',
  'aria-label': ariaLabel,
  showLabel = false,
  playLabel = 'Preview Audio',
  pauseLabel = 'Pause',
}: Props) => {
  // Default aria-label if not provided
  const defaultAriaLabel = isPlaying ? pauseLabel : playLabel
  const finalAriaLabel = ariaLabel || defaultAriaLabel

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      disabled={disabled}
      aria-label={finalAriaLabel}
      data-testid={testId}
    >
      {showLabel ? (
        // Desktop: text label
        <span className={labelClassName}>{isPlaying ? pauseLabel : playLabel}</span>
      ) : (
        // Mobile: icon only
        <>
          {isPlaying ? (
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          )}
        </>
      )}
      {canPlay && (
        <kbd className={shortcutClassName} aria-label="Keyboard shortcut: Space">
          Space
        </kbd>
      )}
    </button>
  )
}

export default PlayButton

