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
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            focusable="false"
            style={{ verticalAlign: 'middle' }}
          >
            <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a1 1 0 1 1 2 0 7 7 0 0 1-6 6.92V21a1 1 0 1 1-2 0v-2.08A7 7 0 0 1 5 12a1 1 0 1 1 2 0 5 5 0 0 0 10 0z"/>
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


