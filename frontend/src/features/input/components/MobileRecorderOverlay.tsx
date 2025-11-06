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
          🎤
        </button>
      </Portal>
      <OverlayModal open={open} onClose={onClose}>{children}</OverlayModal>
    </>
  )
}

const OverlayModal = ({ open: isOpen, onClose: handleClose, children: modalChildren }: { open: boolean; onClose: () => void; children: React.ReactNode }) => {
  if (!isOpen) return null
  return (
    <Portal>
      <MobileModal open={isOpen} onClose={handleClose}>{modalChildren}</MobileModal>
    </Portal>
  )
}

export default MobileRecorderOverlay


