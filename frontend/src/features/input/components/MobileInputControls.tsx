import { useCallback, useEffect, useRef, useState } from 'react'
import type { DetectionMode } from '../../meter/components/DetectionModeSwitch'
import { useDetection } from '../../meter/useDetection'
import { sendLexicalText, sendProsodicAudio } from '../apiService'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { useWaveform } from '../hooks/useWaveform'
import { formatDuration, isMacPlatform } from '../utils'
import MicButton from './MicButton'
import SharedTextArea from './SharedTextArea'
import SpeechStatus from './SpeechStatus'
import Waveform from './Waveform'

const STORAGE_KEY = 'sarcasm-detector-visited'

type MobileInputControlsProps = {
  detectionMode: DetectionMode
}

/**
 * Consolidated input controls for mobile/tablet.
 * Shows all controls in a grid layout - no modals needed.
 * Audio controls are disabled in lexical mode.
 */
const MobileInputControls = ({ detectionMode }: MobileInputControlsProps) => {
  const isLexical = detectionMode === 'lexical'
  const isProsodic = detectionMode === 'prosodic'

  // Text state (lexical mode only)
  const [text, setText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [hasEverTyped, setHasEverTyped] = useState(false)

  // Detection context
  const { setLoading, setDetectionResult } = useDetection()

  // Refs
  const micBtnRef = useRef<HTMLButtonElement>(null)

  // Create a stable ref for isRecording that speech recognition needs
  const isRecordingRef = useRef<boolean>(false)

  // Refs for handlers that need to reference recorder (for circular dependency)
  const updateTranscriptRef = useRef<(update: { interim: string; final: string }) => void>(() => {})
  const setErrorRef = useRef<(error: string | null) => void>(() => {})

  // ─────────────────────────────────────────────────────────────────────────────
  // Speech recognition hook
  // ─────────────────────────────────────────────────────────────────────────────

  const handleTranscriptUpdate = useCallback(
    ({ interim, final }: { interim: string; final: string }) => {
      updateTranscriptRef.current({ interim, final })
    },
    []
  )

  const handleSpeechError = useCallback((message: string) => {
    setErrorRef.current(message)
  }, [])

  const { startSpeechRecognition, stopSpeechRecognition, speechStatus, resetSpeechStatus } =
    useSpeechRecognition({
      isRecordingRef,
      onTranscriptUpdate: handleTranscriptUpdate,
      onError: handleSpeechError,
    })

  // ─────────────────────────────────────────────────────────────────────────────
  // Waveform hook
  // ─────────────────────────────────────────────────────────────────────────────

  const [isRecording, setIsRecording] = useState(false)

  const {
    canvasRef,
    setupWaveform,
    cleanupWaveform,
    invalidatePeaks,
    computePeaksFromBlob,
    resetWaveform,
  } = useWaveform({ isRecording })

  // ─────────────────────────────────────────────────────────────────────────────
  // Audio Recorder hook
  // ─────────────────────────────────────────────────────────────────────────────

  const recorder = useAudioRecorder({
    waveformControls: {
      setupWaveform,
      cleanupWaveform,
      invalidatePeaks,
      computePeaksFromBlob,
      resetWaveform,
    },
    speechControls: {
      startSpeechRecognition,
      stopSpeechRecognition,
    },
    onRecordingStart: () => {
      // Dismiss first-time overlay on mobile/tablet when recording starts
      localStorage.setItem(STORAGE_KEY, 'true')
    },
  })

  const {
    state,
    playback,
    audioRef,
    startRecording: startRecordingBase,
    stopRecording,
    discardRecording,
    togglePlay,
    handleSeek,
    updateTranscript,
    setError,
    canPlay: canPlayBase,
    canDiscard: canDiscardBase,
  } = recorder

  // Wire up the refs for circular dependency resolution
  useEffect(() => {
    updateTranscriptRef.current = updateTranscript
    setErrorRef.current = setError
  }, [updateTranscript, setError])

  // Keep the shared isRecordingRef in sync with recorder state
  useEffect(() => {
    isRecordingRef.current = state.isRecording
    setIsRecording(state.isRecording)
  }, [state.isRecording])

  // ─────────────────────────────────────────────────────────────────────────────
  // Mode-aware recording (disabled in lexical mode)
  // ─────────────────────────────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    if (isLexical) {
      // Recording is disabled in lexical mode
      return
    }
    await startRecordingBase()
  }, [isLexical, startRecordingBase])

  // Clear audio state when switching to lexical mode
  useEffect(() => {
    if (isLexical) {
      // Stop any active recording
      if (state.isRecording) {
        stopRecording()
      }

      // Stop playback if playing
      const el = audioRef.current
      if (el) {
        el.pause()
        el.currentTime = 0
      }

      // Discard recording if there is one
      if (state.audioBlob || state.audioUrl) {
        discardRecording()
      }
    }
  }, [
    isLexical,
    state.isRecording,
    state.audioBlob,
    state.audioUrl,
    stopRecording,
    discardRecording,
    audioRef,
  ])

  // ─────────────────────────────────────────────────────────────────────────────
  // Derived state (mode-aware)
  // ─────────────────────────────────────────────────────────────────────────────

  const canPlay = isProsodic && canPlayBase && !isSending
  const canDiscard = isProsodic && canDiscardBase && !isSending

  // ─────────────────────────────────────────────────────────────────────────────
  // Mic button handlers
  // ─────────────────────────────────────────────────────────────────────────────

  const onMicClick = useCallback(() => {
    if (state.isRecording) stopRecording()
    else startRecording()
  }, [state.isRecording, stopRecording, startRecording])

  const onMicKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.code === 'Enter') {
        onMicClick()
        e.preventDefault()
      }
    },
    [onMicClick]
  )

  // ─────────────────────────────────────────────────────────────────────────────
  // Send functions
  // ─────────────────────────────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const trimmedText = text.trim()
    const fullTranscript = (state.transcript + ' ' + state.interimTranscript).trim()

    // In lexical mode: send text
    // In prosodic mode: send audio (and optionally text/transcript)
    if (isLexical) {
      if (!trimmedText) return
      setIsSending(true)
      setError(null)
      setLoading(true)
      try {
        const response = await sendLexicalText(trimmedText)
        setDetectionResult({
          lexical: response.value,
          prosodic: 0,
          lexicalReliable: response.reliable,
          prosodicReliable: true,
        })
        setText('')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to send')
      } finally {
        setIsSending(false)
        setLoading(false)
      }
    } else {
      // Prosodic mode
      if (!state.audioBlob) return
      setIsSending(true)
      setError(null)
      setLoading(true)
      try {
        const [prosodicResponse, lexicalResponse] = await Promise.all([
          sendProsodicAudio(state.audioBlob),
          fullTranscript
            ? sendLexicalText(fullTranscript)
            : Promise.resolve({ id: 'no-text', value: 0, reliable: true }),
        ])
        setDetectionResult({
          lexical: lexicalResponse.value,
          prosodic: prosodicResponse.value,
          lexicalReliable: lexicalResponse.reliable,
          prosodicReliable: prosodicResponse.reliable,
        })
        discardRecording()
        setText('')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to send')
      } finally {
        setIsSending(false)
        setLoading(false)
      }
    }
  }, [
    isLexical,
    text,
    state.transcript,
    state.interimTranscript,
    state.audioBlob,
    setLoading,
    setDetectionResult,
    discardRecording,
    setError,
  ])

  // Keyboard shortcut for send (on the container)
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  // ─────────────────────────────────────────────────────────────────────────────
  // Global keyboard shortcuts
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea or contenteditable element
      const target = e.target as HTMLElement | null
      if (target) {
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.getAttribute('role') === 'textbox'
        ) {
          return
        }
        // Check if target is inside an editable ancestor
        let ancestor: HTMLElement | null = target.parentElement
        while (ancestor) {
          if (
            ancestor.tagName === 'INPUT' ||
            ancestor.tagName === 'TEXTAREA' ||
            ancestor.isContentEditable ||
            ancestor.getAttribute('role') === 'textbox'
          ) {
            return
          }
          ancestor = ancestor.parentElement
        }

        // Ignore if the focused element is a button that performs the same action
        const buttonAncestor = target.closest('button')
        if (buttonAncestor) {
          if (
            e.code === 'Space' &&
            buttonAncestor.getAttribute('data-testid') === 'mobile-play-button'
          ) {
            return
          }
          if (
            (e.code === 'Delete' || e.code === 'Backspace') &&
            buttonAncestor.getAttribute('data-testid') === 'mobile-trash-button'
          ) {
            return
          }
        }
      }

      // Space - toggle play/pause
      if (e.code === 'Space' && canPlay) {
        e.preventDefault()
        togglePlay()
      }

      // Delete/Backspace - discard recording
      if ((e.code === 'Delete' || e.code === 'Backspace') && canDiscard) {
        e.preventDefault()
        discardRecording()
      }

      // R - toggle recording (only in prosodic mode)
      if (e.code === 'KeyR' && isProsodic && !playback.isPlaying && !isSending) {
        e.preventDefault()
        onMicClick()
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [
    canPlay,
    canDiscard,
    isProsodic,
    playback.isPlaying,
    isSending,
    togglePlay,
    discardRecording,
    onMicClick,
  ])

  // ─────────────────────────────────────────────────────────────────────────────
  // Derived values for rendering
  // ─────────────────────────────────────────────────────────────────────────────

  const isMac = isMacPlatform()
  const modifierKey = isMac ? '⌘' : 'Ctrl'

  // Waveform playhead calculations
  const playheadPercent =
    playback.audioDurationMs > 0
      ? Math.min(1, Math.max(0, playback.playbackMs / playback.audioDurationMs))
      : 0
  const isSeekEnabled = canPlay && !state.isRecording

  // Determine what to show in textarea
  const textareaValue = isProsodic
    ? (state.transcript + ' ' + state.interimTranscript).trim()
    : text

  const textareaPlaceholder = isProsodic
    ? speechStatus === 'loading'
      ? 'Loading speech model...'
      : 'Transcription will appear here...'
    : 'Type something here and send it to the detector...'

  // Can send logic
  const canSendLexical = !!text.trim() && !isSending
  const canSendProsodic = !!state.audioBlob && !isSending
  const canSend = isLexical ? canSendLexical : canSendProsodic

  return (
    <div
      className="mobile-input-controls"
      data-mode={detectionMode}
      data-testid="mobile-input-controls"
      onKeyDown={onKeyDown}
    >
      {/* Textarea - full width */}
      <div className="mobile-input-controls__textarea">
        <SharedTextArea
          value={textareaValue}
          onChange={
            isProsodic
              ? undefined
              : newText => {
                  setText(newText)
                  if (newText.length > 0 && !hasEverTyped) {
                    setHasEverTyped(true)
                    localStorage.setItem(STORAGE_KEY, 'true')
                  }
                }
          }
          placeholder={textareaPlaceholder}
          disabled={isSending || isProsodic}
          rows={2}
          aria-label={isProsodic ? 'Speech transcription (read-only)' : 'Text input'}
          shouldFlash={isLexical && !hasEverTyped}
        />
      </div>

      {/* Audio row: mic, waveform, play, trash */}
      <div className="mobile-input-controls__audio-row">
        {/* Record button */}
        <MicButton
          ref={micBtnRef}
          isRecording={state.isRecording}
          shouldFlash={isProsodic && !state.audioBlob && !state.isRecording}
          disabled={isLexical || playback.isPlaying || isSending}
          onClick={onMicClick}
          onKeyDown={onMicKeyDown}
        />

        {/* Waveform - takes available space */}
        <div className="mobile-input-controls__waveform-wrapper">
          <Waveform
            ref={canvasRef}
            showPlayhead={!!state.audioUrl && !state.isRecording}
            playheadPercent={playheadPercent}
            isSeekEnabled={isSeekEnabled}
            onSeekPercent={handleSeek}
            showEmpty={isProsodic && !state.isRecording && !state.audioUrl}
            emptyMessage=""
          />
          {isProsodic && (state.isRecording || state.audioBlob) && (
            <span className="mobile-input-controls__duration">
              {state.isRecording || !playback.isPlaying
                ? formatDuration(state.durationMs)
                : formatDuration(playback.playbackMs)}
            </span>
          )}
        </div>

        {/* Play button */}
        <button
          type="button"
          className={`mobile-input-controls__play ${canPlay ? 'mobile-input-controls__play--with-shortcut' : ''}`}
          onClick={togglePlay}
          disabled={!canPlay}
          aria-label={playback.isPlaying ? 'Pause' : 'Play'}
          data-testid="mobile-play-button"
        >
          {playback.isPlaying ? (
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          )}
          {canPlay && (
            <kbd
              className="mobile-input-controls__btn-shortcut"
              aria-label="Keyboard shortcut: Space"
            >
              Space
            </kbd>
          )}
        </button>

        {/* Trash button */}
        <button
          type="button"
          className={`mobile-input-controls__trash ${canDiscard ? 'mobile-input-controls__trash--with-shortcut' : ''}`}
          onClick={discardRecording}
          disabled={!canDiscard}
          aria-label="Discard recording"
          data-testid="mobile-trash-button"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            width="20"
            height="20"
            aria-hidden="true"
          >
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </svg>
          {canDiscard && (
            <kbd
              className="mobile-input-controls__btn-shortcut"
              aria-label="Keyboard shortcut: Delete"
            >
              Del
            </kbd>
          )}
        </button>
      </div>

      {/* Send button */}
      <div className="mobile-input-controls__send">
        <button
          type="button"
          className={`mobile-input-controls__send-btn ${canSend ? 'mobile-input-controls__send-btn--active' : ''}`}
          onClick={handleSend}
          disabled={!canSend}
          data-testid="mobile-send-button"
        >
          <span>{isSending ? 'Sending...' : 'Send to Detector'}</span>
          {canSend && <kbd className="mobile-input-controls__shortcut">{modifierKey}+↵</kbd>}
        </button>
      </div>

      {/* Hidden audio element for playback */}
      <audio ref={audioRef} src={state.audioUrl ?? undefined} preload="metadata" />

      {/* Speech status (loading/error for speech-to-text model) */}
      <SpeechStatus
        status={speechStatus}
        isRecording={state.isRecording}
        onDismiss={resetSpeechStatus}
      />

      {/* Error display */}
      {state.error && (
        <div className="mobile-input-controls__error" role="alert">
          {state.error}
        </div>
      )}
    </div>
  )
}

export default MobileInputControls
