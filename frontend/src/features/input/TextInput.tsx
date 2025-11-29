import { useState } from 'react'
import SharedTextArea from './components/SharedTextArea'
import { sendLexicalText } from './apiService'

const TextInput = () => {
  const [text, setText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasEverTyped, setHasEverTyped] = useState(false)

  const handleSend = async () => {
    const payload = text.trim()
    if (!payload) return
    setIsSending(true)
    setError(null)
    try {
      await sendLexicalText(payload)
      setText('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send'
      setError(msg)
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
        className="text-input__textarea"
        shouldFlash={!hasEverTyped}
      />
      <div className="text-input__controls">
        <button
          type="button"
          className="text-input__send-btn"
          onClick={handleSend}
          disabled={!text.trim() || isSending}
        >
          {isSending ? 'Sending...' : 'Send to Detector'}
        </button>
      </div>
      {error && <div className="text-input__error" role="alert">{error}</div>}
    </div>
  )
}

export default TextInput
