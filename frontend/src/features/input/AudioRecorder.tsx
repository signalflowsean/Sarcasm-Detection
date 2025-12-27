import { useCallback, useEffect, useRef, useState } from 'react'
import { useDetection } from '../meter/hooks/useDetection'
import { NO_TEXT_RESPONSE_ID, sendLexicalText, sendProsodicAudio } from './apiService'
import RecorderContent from './components/RecorderContent'
import SpeechStatus from './components/SpeechStatus'
import { useSpeechRecognition } from './hooks/speech'
import { useAudioRecorder } from './hooks/useAudioRecorder'
import { useDevLoadingOverride } from './hooks/useDevLoadingOverride'
import { useWaveform } from './hooks/useWaveform'
import { formatDuration } from './utils'
import { isDev } from './utils/env'

type AudioRecorderProps = {
  onClose?: () => void
}

const AudioRecorder = ({ onClose }: AudioRecorderProps = {}) => {
  // Local sending state (not part of recorder hook since it's API-related)
  const [isSending, setIsSending] = useState(false)

  // Track if user has ever started recording (to control mic button flash)
  const [hasEverRecorded, setHasEverRecorded] = useState(false)

  // Detection context for meter display
  const { setLoading, setDetectionResult } = useDetection()

  // Create a stable ref for isRecording that we'll pass to speech recognition
  // This needs to exist before speech recognition hook is called
  const isRecordingRef = useRef<boolean>(false)

  // Refs for handlers that need to reference recorder (for circular dependency)
  const updateTranscriptRef = useRef<(update: { interim: string; final: string }) => void>(() => {})
  const setErrorRef = useRef<(error: string | null) => void>(() => {})

  // ─────────────────────────────────────────────────────────────────────────────
  // Speech recognition hook (needs isRecordingRef)
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
  // Waveform hook (needs isRecording state, but we don't have it yet)
  // We'll use a local state that gets synced with recorder state
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
      setHasEverRecorded(true)
    },
  })

  const {
    state,
    playback,
    audioRef,
    startRecording,
    stopRecording,
    discardRecording,
    togglePlay,
    handleSeek,
    updateTranscript,
    setError,
    canPlay,
    canDiscard,
  } = recorder

  // Wire up the refs for circular dependency resolution
  // Initialize synchronously to avoid race condition window, then keep in sync via useEffect
  updateTranscriptRef.current = updateTranscript
  setErrorRef.current = setError

  // Keep refs in sync if functions change identity (shouldn't happen due to useCallback, but defensive)
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
  // Mic button handlers
  // ─────────────────────────────────────────────────────────────────────────────

  const micBtnRef = useRef<HTMLButtonElement>(null)

  const onMicClick = useCallback(() => {
    if (state.isRecording) stopRecording()
    else startRecording()
  }, [state.isRecording, stopRecording, startRecording])

  const onMicKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Only handle Enter (Space is reserved for playback toggle)
      if (e.code === 'Enter') {
        onMicClick()
        e.preventDefault()
      } else if (e.code === 'Escape' && !state.isRecording) {
        // Only discard when not recording
        discardRecording()
        e.preventDefault()
      }
    },
    [onMicClick, state.isRecording, discardRecording]
  )

  // ─────────────────────────────────────────────────────────────────────────────
  // Send
  // ─────────────────────────────────────────────────────────────────────────────

  const onSend = useCallback(async () => {
    if (!state.audioBlob) return
    setIsSending(true)
    setError(null)
    // Signal detection loading state to meter
    setLoading(true)
    try {
      const [prosodicResponse, lexicalResponse] = await Promise.all([
        sendProsodicAudio(state.audioBlob),
        state.transcript.trim()
          ? sendLexicalText(state.transcript.trim())
          : Promise.resolve({ id: NO_TEXT_RESPONSE_ID, value: 0, reliable: true }),
      ])
      // Pass both values to detection provider, including reliability info
      // setDetectionResult will handle resetting loading state
      setDetectionResult({
        lexical: lexicalResponse.value,
        prosodic: prosodicResponse.value,
        lexicalReliable: lexicalResponse.reliable,
        prosodicReliable: prosodicResponse.reliable,
      })
      // Successfully sent - discard the recording to allow a new one
      discardRecording()
      // Close modal after successful send (mobile only)
      onClose?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send'
      setError(message)
      // Reset loading state on error
      setLoading(false)
    } finally {
      setIsSending(false)
    }
  }, [
    state.audioBlob,
    state.transcript,
    setLoading,
    setDetectionResult,
    discardRecording,
    onClose,
    setError,
  ])

  // ─────────────────────────────────────────────────────────────────────────────
  // Dev mode: Toggle loading spinner override
  // ─────────────────────────────────────────────────────────────────────────────

  const devLoadingOverride = useDevLoadingOverride()

  // ─────────────────────────────────────────────────────────────────────────────
  // Global keyboard shortcuts
  // ─────────────────────────────────────────────────────────────────────────────

  // "R" key to toggle recording
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'KeyR') return
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return

      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (playback.isPlaying || isSending) return

      e.preventDefault()
      if (state.isRecording) {
        stopRecording()
      } else {
        startRecording()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state.isRecording, isSending, playback.isPlaying, startRecording, stopRecording])

  // Delete/Backspace key to discard recording
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Delete' && e.code !== 'Backspace') return

      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      if (state.audioBlob && !state.isRecording && !isSending) {
        e.preventDefault()
        discardRecording()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state.audioBlob, state.isRecording, isSending, discardRecording])

  // Cmd/Ctrl+Enter to send
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!((e.metaKey || e.ctrlKey) && e.key === 'Enter')) return

      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      if (state.audioBlob && !isSending) {
        e.preventDefault()
        onSend()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state.audioBlob, isSending, onSend])

  // Space bar to toggle playback
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return

      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      if (state.audioUrl && !state.isRecording && !isSending) {
        e.preventDefault()
        togglePlay()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state.isRecording, isSending, state.audioUrl, togglePlay])

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  const durationLabel = state.isRecording
    ? formatDuration(state.durationMs)
    : formatDuration(playback.playbackMs)

  const playheadPercent =
    playback.audioDurationMs > 0
      ? Math.min(1, Math.max(0, playback.playbackMs / playback.audioDurationMs))
      : 0

  // Apply dev mode loading override (works even when not recording)
  const displaySpeechStatus = isDev() && devLoadingOverride ? 'loading' : speechStatus

  return (
    <>
      <RecorderContent
        isRecording={state.isRecording}
        shouldFlashMic={!hasEverRecorded && !state.isRecording}
        durationLabel={durationLabel}
        micRef={micBtnRef}
        canvasRef={canvasRef}
        audioRef={audioRef}
        audioSrc={state.audioUrl ?? undefined}
        speechStatus={displaySpeechStatus}
        transcript={state.transcript}
        interimTranscript={state.interimTranscript}
        isPlaying={playback.isPlaying}
        canPlay={canPlay}
        canDiscard={canDiscard}
        canSend={!!state.audioBlob}
        sending={isSending}
        showPlayhead={!state.isRecording && !!state.audioUrl}
        playheadPercent={playheadPercent}
        isSeekEnabled={!state.isRecording && !!state.audioUrl}
        autoStopCountdown={state.autoStopCountdown}
        onSeekPercent={handleSeek}
        onMicClick={onMicClick}
        onMicKeyDown={onMicKeyDown}
        onTogglePlay={togglePlay}
        onDiscard={discardRecording}
        onSend={onSend}
      />
      <SpeechStatus
        status={displaySpeechStatus}
        isRecording={state.isRecording}
        onDismiss={resetSpeechStatus}
      />
      {state.error && (
        <div className="audio-recorder__error" role="alert" data-testid="audio-error">
          {state.error}
        </div>
      )}
    </>
  )
}

export default AudioRecorder
