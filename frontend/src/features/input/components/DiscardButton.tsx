type Props = {
  onClick: () => void
  disabled?: boolean
  canDiscard?: boolean
  className?: string
  shortcutClassName?: string
  testId?: string
  'aria-label'?: string
}

/**
 * Shared discard/trash button component.
 * Used in both desktop (Controls) and mobile (MobileInputControls) layouts.
 */
const DiscardButton = ({
  onClick,
  disabled = false,
  canDiscard = false,
  className = '',
  shortcutClassName = '',
  testId = 'discard-button',
  'aria-label': ariaLabel = 'Discard recording',
}: Props) => {
  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      data-testid={testId}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        width="20"
        height="20"
        aria-hidden="true"
      >
        <path d="M3 6h18" />
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      </svg>
      {canDiscard && (
        <kbd className={shortcutClassName} aria-label="Keyboard shortcut: Delete">
          Del
        </kbd>
      )}
    </button>
  )
}

export default DiscardButton
