import { createPortal } from 'react-dom'
import MobileModal from './MobileModal'

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
      <BodyPortal>
        <button
          type="button"
          className={launcherClass}
          aria-label="Open audio recorder"
          onClick={onOpen}
        >
          🎤
        </button>
      </BodyPortal>
      <OverlayModal open={open} onClose={onClose}>{children}</OverlayModal>
    </>
  )
}

const BodyPortal = ({ children }: { children: React.ReactNode }) => createPortal(children, document.body)

const OverlayModal = ({ open: isOpen, onClose: handleClose, children: modalChildren }: { open: boolean; onClose: () => void; children: React.ReactNode }) => {
  if (!isOpen) return null
  return (
    <BodyPortal>
      <MobileModal open={isOpen} onClose={handleClose}>{modalChildren}</MobileModal>
    </BodyPortal>
  )
}

export default MobileRecorderOverlay


