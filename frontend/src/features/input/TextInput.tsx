import { useState } from 'react'
import SharedTextArea from './components/SharedTextArea'
import { sendLexicalText } from './apiService'
import { isMacPlatform } from './utils'
import { useDetection } from '../meter/useDetection'

type TextInputProps = {
  onClose?: () => void
}

const TextInput = ({ onClose }: TextInputProps = {}) => {
  const [text, setText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasEverTyped, setHasEverTyped] = useState(false)

  const { setLoading, setDetectionResult } = useDetection()

  // Detect platform for keyboard shortcut display
  const isMac = isMacPlatform()
  const modifierKey = isMac ? '⌘' : 'Ctrl'

  const handleSend = async () => {
    const payload = text.trim()
    if (!payload) return
    setIsSending(true)
    setError(null)
    // Signal detection loading state to meter
    setLoading(true)
    try {
      const response = await sendLexicalText(payload)
      // Pass lexical value to detection provider (prosodic stays at 0 for text mode)
      setDetectionResult({ lexical: response.value, prosodic: 0 })
      setText('')
      // Close modal after successful send (mobile only)
      onClose?.()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send'
      setError(msg)
      // Reset loading state on error
      setLoading(false)
    } finally {
      setIsSending(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
  }

  const handleTextChange = (newText: string) => {
    setText(newText)
    if (newText.length > 0 && !hasEverTyped) {
      setHasEverTyped(true)
    }
  }

  return (
    <div className="text-input" onKeyDown={onKeyDown}>
      <SharedTextArea
        value={text}
        onChange={handleTextChange}
        placeholder="Type something here and send it to the detector — we'll see if it's sarcastic."
        shouldFlash={!hasEverTyped}
        disabled={isSending}
      />
      <div className="text-input__controls">
        <button
          type="button"
          className={`text-input__send-btn ${text.trim() && !isSending ? 'text-input__send-btn--with-shortcut' : ''}`}
          onClick={handleSend}
          disabled={!text.trim() || isSending}
        >
          <span className="text-input__send-btn__label">
            {isSending ? 'Sending...' : 'Send to Detector'}
          </span>
          {text.trim() && !isSending && (
            <kbd className="text-input__send-btn__shortcut" aria-label={`Keyboard shortcut: ${modifierKey} + Enter`}>
              {modifierKey}+↵
            </kbd>
          )}
        </button>
      </div>
      {error && <div className="text-input__error" role="alert">{error}</div>}
    </div>
  )
}

export default TextInput
