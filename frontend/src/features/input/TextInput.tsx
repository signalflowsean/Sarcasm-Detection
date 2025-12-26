import { useState } from 'react'
import { useDetection } from '../meter/hooks/useDetection'
import { sendLexicalText } from './apiService'
import ExamplePhrases from './components/ExamplePhrases'
import SharedTextArea from './components/SharedTextArea'
import { isMacPlatform, isMobileBrowser } from './utils'

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
  const isMobile = isMobileBrowser()

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
      // setDetectionResult will handle resetting loading state
      setDetectionResult({
        lexical: response.value,
        prosodic: 0,
        lexicalReliable: response.reliable,
        prosodicReliable: true, // Not used in text mode
      })
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

  const hasText = text.trim().length > 0
  const sendLabel = isSending ? 'Sending...' : hasText ? 'Send to Detector' : 'Type Text First'

  // Flash the send button when text is ready but not sending
  const shouldFlash = hasText && !isSending

  const handleExampleSelect = (phrase: string) => {
    setText(phrase)
    if (!hasEverTyped) {
      setHasEverTyped(true)
    }
  }

  return (
    <div className="text-input" onKeyDown={onKeyDown} data-testid="text-input">
      <SharedTextArea
        value={text}
        onChange={handleTextChange}
        placeholder="Type something here and send it to the detector — we'll see if it's sarcastic."
        shouldFlash={!hasEverTyped}
        disabled={isSending}
      />
      <ExamplePhrases onSelect={handleExampleSelect} disabled={isSending} />
      <div className="text-input__controls">
        <button
          type="button"
          className={`text-input__send-btn ${hasText && !isSending && !isMobile ? 'text-input__send-btn--with-shortcut' : ''} ${shouldFlash ? 'text-input__send-btn--flash' : ''}`}
          onClick={handleSend}
          disabled={!hasText || isSending}
          data-testid="text-send-button"
        >
          <span className="text-input__send-btn__label">{sendLabel}</span>
          {hasText && !isSending && !isMobile && (
            <kbd
              className="text-input__send-btn__shortcut"
              aria-label={`Keyboard shortcut: ${modifierKey} + Enter`}
            >
              {modifierKey}+↵
            </kbd>
          )}
        </button>
      </div>
      {error && (
        <div className="text-input__error" role="alert" data-testid="text-error">
          {error}
        </div>
      )}
    </div>
  )
}

export default TextInput
