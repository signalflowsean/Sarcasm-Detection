import MobileModal from './MobileModal'
import Portal from './Portal'

type Props = {
  open: boolean
  onOpen: () => void
  onClose: () => void
  children: React.ReactNode
}

const MobileRecorderOverlay = ({ open, onOpen, onClose, children }: Props) => {
  let launcherClass = 'audio-recorder__launcher'
  if (open) launcherClass += ' is-hidden'

  return (
    <>
      <Portal>
        <button
          type="button"
          className={launcherClass}
          aria-label="Open audio recorder"
          onClick={onOpen}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            width="24"
            height="24"
          >
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </svg>
        </button>
      </Portal>
      {open && (
        <Portal>
          <MobileModal open={open} onClose={onClose}>
            {children}
          </MobileModal>
        </Portal>
      )}
    </>
  )
}

export default MobileRecorderOverlay
