import { useCallback, useEffect, useRef, useState } from 'react'
import type { DetectionMode } from '../../meter/components/DetectionModeSwitch'
import { useDetection } from '../../meter/useDetection'
import { sendLexicalText, sendProsodicAudio } from '../apiService'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { useWaveform } from '../hooks/useWaveform'
import { clamp01, formatDuration, isMacPlatform } from '../utils'
import MicButton from './MicButton'
import SharedTextArea from './SharedTextArea'
import SpeechStatus from './SpeechStatus'
import Waveform from './Waveform'

const STORAGE_KEY = 'sarcasm-detector-visited'

type MobileInputControlsProps = {
  detectionMode: DetectionMode
}

type Nullable<T> = T | null

/**
 * Consolidated input controls for mobile/tablet.
 * Shows all controls in a grid layout - no modals needed.
 * Audio controls are disabled in lexical mode.
 */
const MobileInputControls = ({ detectionMode }: MobileInputControlsProps) => {
  const isLexical = detectionMode === 'lexical'
  const isProsodic = detectionMode === 'prosodic'

  // Text state (shared between modes)
  const [text, setText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<Nullable<string>>(null)
  const [hasEverTyped, setHasEverTyped] = useState(false)

  // Audio state (prosodic mode only)
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Nullable<Blob>>(null)
  const [audioUrl, setAudioUrl] = useState<Nullable<string>>(null)
  const [durationMs, setDurationMs] = useState(0)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackMs, setPlaybackMs] = useState(0)
  const [audioDurationMs, setAudioDurationMs] = useState(0)

  // Detection context
  const { setLoading, setDetectionResult } = useDetection()

  // Refs
  const mediaRecorderRef = useRef<Nullable<MediaRecorder>>(null)
  const mediaStreamRef = useRef<Nullable<MediaStream>>(null)
  const audioChunksRef = useRef<BlobPart[]>([])
  const startTimeRef = useRef<number>(0)
  const timerIntervalRef = useRef<number | null>(null)
  const isRecordingRef = useRef<boolean>(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const micBtnRef = useRef<HTMLButtonElement>(null)

  // Keep ref in sync
  useEffect(() => {
    isRecordingRef.current = isRecording
  }, [isRecording])

  // Waveform hook
  const {
    canvasRef,
    setupWaveform,
    cleanupWaveform,
    invalidatePeaks,
    computePeaksFromBlob,
    resetWaveform,
  } = useWaveform({ isRecording })

  // Speech recognition
  const handleTranscriptUpdate = useCallback(
    ({ interim, final }: { interim: string; final: string }) => {
      setInterimTranscript(interim)
      setTranscript(prev => prev + final)
    },
    []
  )

  const handleSpeechError = useCallback((message: string) => {
    setError(message)
  }, [])

  const { startSpeechRecognition, stopSpeechRecognition, speechStatus, resetSpeechStatus } =
    useSpeechRecognition({
      isRecordingRef,
      onTranscriptUpdate: handleTranscriptUpdate,
      onError: handleSpeechError,
    })

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    }
  }, [audioUrl])

  // Timer functions
  const startTimer = useCallback(() => {
    startTimeRef.current = performance.now()
    const tick = () => {
      setDurationMs(Math.max(0, performance.now() - startTimeRef.current))
    }
    tick()
    timerIntervalRef.current = window.setInterval(tick, 100)
  }, [])

  const stopTimer = useCallback(() => {
    if (timerIntervalRef.current != null) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }
  }, [])

  // Recording functions
  const startRecording = useCallback(async () => {
    if (isLexical) {
      // Recording is disabled in lexical mode
      return
    }

    if (isRecording) {
      // Already recording, ignore duplicate call
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Audio recording not supported in this browser.')
      return
    }

    // Clear previous recording
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    invalidatePeaks()

    setAudioBlob(null)
    setAudioUrl(null)
    setTranscript('')
    setInterimTranscript('')
    setError(null)
    setPlaybackMs(0)
    setAudioDurationMs(0)
    resetWaveform()

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream

      const preferredTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ]
      const chosenType =
        preferredTypes.find(t => {
          try {
            return MediaRecorder.isTypeSupported(t)
          } catch {
            return false
          }
        }) || null

      const mr = new MediaRecorder(stream, chosenType ? { mimeType: chosenType } : undefined)
      audioChunksRef.current = []

      mr.ondataavailable = e => {
        if (e.data?.size > 0) audioChunksRef.current.push(e.data)
      }

      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || chosenType || '' })
        const url = URL.createObjectURL(blob)
        setAudioBlob(blob)
        setAudioUrl(url)
        setPlaybackMs(0)
        computePeaksFromBlob(blob)
      }

      mediaRecorderRef.current = mr
      await setupWaveform(stream)
      mr.start()
      startTimer()
      startSpeechRecognition()
      setIsRecording(true)
      // Dismiss first-time overlay on mobile/tablet when recording starts
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Microphone permission denied'
      setError(message)
    }
  }, [
    isRecording,
    isLexical,
    audioUrl,
    invalidatePeaks,
    resetWaveform,
    setupWaveform,
    startTimer,
    startSpeechRecognition,
    computePeaksFromBlob,
  ])

  const stopRecording = useCallback(() => {
    if (!isRecording) return
    const mr = mediaRecorderRef.current
    if (mr && mr.state !== 'inactive') mr.stop()
    mediaRecorderRef.current = null
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop())
      mediaStreamRef.current = null
    }
    cleanupWaveform()
    stopTimer()
    stopSpeechRecognition()
    setIsRecording(false)
  }, [isRecording, cleanupWaveform, stopTimer, stopSpeechRecognition])

  const discardRecording = useCallback(() => {
    const el = audioRef.current
    if (el) {
      el.pause()
      el.currentTime = 0
    }
    stopRecording()
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioBlob(null)
    setAudioUrl(null)
    setDurationMs(0)
    setTranscript('')
    setInterimTranscript('')
    setPlaybackMs(0)
    setAudioDurationMs(0)
    resetWaveform()
  }, [stopRecording, audioUrl, resetWaveform])

  // Clear audio state when switching to lexical mode
  useEffect(() => {
    // If switching to lexical mode, always clear all audio-related state
    // This prevents audio from being stuck in an inaccessible state
    if (isLexical) {
      // Stop any active recording
      if (isRecording) {
        stopRecording()
      }

      // Stop playback if playing
      const el = audioRef.current
      if (el) {
        el.pause()
        el.currentTime = 0
      }

      // Clean up audio URL if it exists
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }

      // Clear all audio state
      setAudioBlob(null)
      setAudioUrl(null)
      setDurationMs(0)
      setTranscript('')
      setInterimTranscript('')
      setPlaybackMs(0)
      setAudioDurationMs(0)
      setIsPlaying(false)
      resetWaveform()
    }
  }, [detectionMode, isLexical, isRecording, audioUrl, stopRecording, resetWaveform])

  // Playback functions
  const togglePlay = useCallback(() => {
    const el = audioRef.current
    if (!el || !audioUrl) return
    if (el.paused) {
      if (!Number.isNaN(el.duration) && Math.abs(el.currentTime - el.duration) < 0.05) {
        el.currentTime = 0
      }
      el.play()
        .then(() => setIsPlaying(true))
        .catch(() => {})
    } else {
      el.pause()
    }
  }, [audioUrl])

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const onEnded = () => setIsPlaying(false)
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onTimeUpdate = () => setPlaybackMs(Math.max(0, el.currentTime * 1000))
    const onLoadedMetadata = () => {
      setPlaybackMs(0)
      setAudioDurationMs(Number.isFinite(el.duration) ? el.duration * 1000 : 0)
    }
    const onSeeked = () => setPlaybackMs(Math.max(0, el.currentTime * 1000))

    // Check if metadata is already loaded
    if (el.readyState >= 1 && Number.isFinite(el.duration) && el.duration > 0) {
      setAudioDurationMs(el.duration * 1000)
    }

    el.addEventListener('ended', onEnded)
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    el.addEventListener('timeupdate', onTimeUpdate)
    el.addEventListener('loadedmetadata', onLoadedMetadata)
    el.addEventListener('seeked', onSeeked)
    return () => {
      el.removeEventListener('ended', onEnded)
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
      el.removeEventListener('timeupdate', onTimeUpdate)
      el.removeEventListener('loadedmetadata', onLoadedMetadata)
      el.removeEventListener('seeked', onSeeked)
    }
  }, [audioUrl])

  // Seek handler for waveform scrubbing (matches AudioRecorder pattern)
  const handleSeek = useCallback(
    (percent: number) => {
      const el = audioRef.current
      if (!el) return
      if (!(audioDurationMs > 0)) return
      const newTime = clamp01(percent) * (audioDurationMs / 1000)
      el.currentTime = newTime
      setPlaybackMs(newTime * 1000)
    },
    [audioDurationMs]
  )

  // Send functions
  const handleSend = useCallback(async () => {
    const trimmedText = text.trim()
    const fullTranscript = (transcript + ' ' + interimTranscript).trim()

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
      if (!audioBlob) return
      setIsSending(true)
      setError(null)
      setLoading(true)
      try {
        const [prosodicResponse, lexicalResponse] = await Promise.all([
          sendProsodicAudio(audioBlob),
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
    transcript,
    interimTranscript,
    audioBlob,
    setLoading,
    setDetectionResult,
    discardRecording,
  ])

  // Mic button handlers
  const onMicClick = useCallback(() => {
    if (isRecording) stopRecording()
    else startRecording()
  }, [isRecording, stopRecording, startRecording])

  const onMicKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.code === 'Enter') {
        onMicClick()
        e.preventDefault()
      }
    },
    [onMicClick]
  )

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

  // Platform detection for shortcut display
  const isMac = isMacPlatform()
  const modifierKey = isMac ? '⌘' : 'Ctrl'

  // Can play/discard logic (for shortcut indicators)
  const canPlay = isProsodic && !!audioUrl && !isSending
  const canDiscard = isProsodic && !!audioBlob && !isRecording && !isSending

  // Waveform playhead calculations (matches AudioRecorder pattern)
  const playheadPercent =
    audioDurationMs > 0 ? Math.min(1, Math.max(0, playbackMs / audioDurationMs)) : 0
  const isSeekEnabled = canPlay && !isRecording

  // Global keyboard shortcuts for audio controls
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea or contenteditable element
      const target = e.target as HTMLElement | null
      if (target) {
        if (target.isContentEditable) {
          return
        }
        const textLikeAncestor = target.closest(
          'input, textarea, [contenteditable="true"], [role="textbox"]'
        )
        if (textLikeAncestor) {
          return
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
      if (e.code === 'KeyR' && isProsodic && !isPlaying && !isSending) {
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
    isPlaying,
    isSending,
    togglePlay,
    discardRecording,
    onMicClick,
  ])

  // Cleanup timer and media resources on unmount
  useEffect(() => {
    return () => {
      // Stop timer if running (access ref directly to avoid stale closure)
      if (timerIntervalRef.current != null) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
      // Stop media recorder if active
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
        mediaRecorderRef.current = null
      }
      // Stop all media tracks
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop())
        mediaStreamRef.current = null
      }
      // Stop speech recognition
      stopSpeechRecognition()
      // Cleanup waveform
      cleanupWaveform()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty dependencies - only run cleanup on unmount. Functions access refs internally, so safe to call.

  // Determine what to show in textarea
  // In prosodic mode: show transcription (readonly)
  // In lexical mode: editable text input
  const textareaValue = isProsodic ? (transcript + ' ' + interimTranscript).trim() : text

  const textareaPlaceholder = isProsodic
    ? speechStatus === 'loading'
      ? 'Loading speech model...'
      : 'Transcription will appear here...'
    : 'Type something here and send it to the detector...'

  // Can send logic
  const canSendLexical = !!text.trim() && !isSending
  const canSendProsodic = !!audioBlob && !isSending
  const canSend = isLexical ? canSendLexical : canSendProsodic

  return (
    <div
      className="mobile-input-controls"
      data-mode={detectionMode}
      data-testid="mobile-input-controls"
      onKeyDown={onKeyDown}
    >
      {/* Textarea - full width */}
      {/* In prosodic mode: readonly, shows transcription */}
      {/* In lexical mode: editable text input */}
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
                    // Dismiss first-time overlay on mobile/tablet
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
          isRecording={isRecording}
          shouldFlash={isProsodic && !audioBlob && !isRecording}
          disabled={isLexical || isPlaying || isSending}
          onClick={onMicClick}
          onKeyDown={onMicKeyDown}
        />

        {/* Waveform - takes available space */}
        <div className="mobile-input-controls__waveform-wrapper">
          <Waveform
            ref={canvasRef}
            showPlayhead={!!audioUrl && !isRecording}
            playheadPercent={playheadPercent}
            isSeekEnabled={isSeekEnabled}
            onSeekPercent={handleSeek}
            showEmpty={isProsodic && !isRecording && !audioUrl}
            emptyMessage=""
          />
          {isProsodic && (isRecording || audioBlob) && (
            <span className="mobile-input-controls__duration">
              {isRecording || !isPlaying ? formatDuration(durationMs) : formatDuration(playbackMs)}
            </span>
          )}
        </div>

        {/* Play button */}
        <button
          type="button"
          className={`mobile-input-controls__play ${canPlay ? 'mobile-input-controls__play--with-shortcut' : ''}`}
          onClick={togglePlay}
          disabled={!canPlay}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          data-testid="mobile-play-button"
        >
          {isPlaying ? (
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

      {/* Send button - positioned adjacent to cable jack */}
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
      <audio ref={audioRef} src={audioUrl ?? undefined} preload="metadata" />

      {/* Speech status (loading/error for speech-to-text model) */}
      <SpeechStatus status={speechStatus} isRecording={isRecording} onDismiss={resetSpeechStatus} />

      {/* Error display */}
      {error && (
        <div className="mobile-input-controls__error" role="alert">
          {error}
        </div>
      )}
    </div>
  )
}

export default MobileInputControls
