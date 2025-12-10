import { useCallback, useEffect, useRef, useState } from 'react'
import { useDetection } from '../meter/useDetection'
import { sendLexicalText, sendProsodicAudio } from './apiService'
import RecorderContent from './components/RecorderContent'
import SpeechStatus from './components/SpeechStatus'
import { useSpeechRecognition } from './hooks/useSpeechRecognition'
import { useWaveform } from './hooks/useWaveform'
import { clamp01, formatDuration } from './utils'

type Nullable<T> = T | null

type RecorderState = {
  isRecording: boolean
  isSending: boolean
  durationMs: number
  transcript: string
  interimTranscript: string
  audioBlob: Nullable<Blob>
  audioUrl: Nullable<string>
  error: Nullable<string>
}

type AudioRecorderProps = {
  onClose?: () => void
}

const AudioRecorder = ({ onClose }: AudioRecorderProps = {}) => {
  const [state, setState] = useState<RecorderState>({
    isRecording: false,
    isSending: false,
    durationMs: 0,
    transcript: '',
    interimTranscript: '',
    audioBlob: null,
    audioUrl: null,
    error: null,
  })

  // Track if user has ever started recording (to control mic button flash)
  const [hasEverRecorded, setHasEverRecorded] = useState(false)

  // Detection context for meter display
  const { setLoading, setDetectionResult } = useDetection()

  // Recording refs
  const mediaRecorderRef = useRef<Nullable<MediaRecorder>>(null)
  const mediaStreamRef = useRef<Nullable<MediaStream>>(null)
  const audioChunksRef = useRef<BlobPart[]>([])
  const startTimeRef = useRef<number>(0)
  const timerIntervalRef = useRef<number | null>(null)
  const isRecordingRef = useRef<boolean>(false)

  // Keep isRecordingRef in sync with state
  useEffect(() => {
    isRecordingRef.current = state.isRecording
  }, [state.isRecording])

  // ─────────────────────────────────────────────────────────────────────────────
  // Waveform hook
  // ─────────────────────────────────────────────────────────────────────────────

  const {
    canvasRef,
    setupWaveform,
    cleanupWaveform,
    invalidatePeaks,
    computePeaksFromBlob,
    resetWaveform,
  } = useWaveform({ isRecording: state.isRecording })

  // ─────────────────────────────────────────────────────────────────────────────
  // Speech recognition hook
  // ─────────────────────────────────────────────────────────────────────────────

  const handleTranscriptUpdate = useCallback(
    ({ interim, final }: { interim: string; final: string }) => {
      setState(s => ({
        ...s,
        interimTranscript: interim,
        transcript: s.transcript + final,
      }))
    },
    []
  )

  const handleSpeechError = useCallback((message: string) => {
    setState(s => ({ ...s, error: message }))
  }, [])

  const {
    startSpeechRecognition,
    stopSpeechRecognition,
    speechSupported,
    speechStatus,
    resetSpeechStatus,
  } = useSpeechRecognition({
    isRecordingRef,
    onTranscriptUpdate: handleTranscriptUpdate,
    onError: handleSpeechError,
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Cleanup blob URL on unmount to prevent memory leaks
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const currentUrl = state.audioUrl
    return () => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl)
      }
    }
  }, [state.audioUrl])

  // ─────────────────────────────────────────────────────────────────────────────
  // Timer - updates every 100ms to avoid excessive re-renders
  // ─────────────────────────────────────────────────────────────────────────────

  const startTimer = () => {
    startTimeRef.current = performance.now()
    const tick = () => {
      setState(s => ({ ...s, durationMs: Math.max(0, performance.now() - startTimeRef.current) }))
    }
    // Update immediately, then every 100ms
    tick()
    timerIntervalRef.current = window.setInterval(tick, 100)
  }

  const stopTimer = () => {
    if (timerIntervalRef.current != null) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Recording lifecycle
  // ─────────────────────────────────────────────────────────────────────────────

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const startRecording = async () => {
    if (state.isRecording) return

    // Check for mediaDevices support (may be unavailable in WebViews/in-app browsers)
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const isInAppBrowser = /FBAN|FBAV|Instagram|Twitter|LinkedInApp|Snapchat/i.test(
        navigator.userAgent
      )
      const message = isInAppBrowser
        ? 'Audio recording not supported in this browser. Please open in Chrome or Safari.'
        : 'Audio recording is not supported in this browser.'
      setState(s => ({ ...s, error: message }))
      return
    }

    // Clear previous recording if it exists
    if (state.audioUrl) {
      URL.revokeObjectURL(state.audioUrl)
    }
    // Invalidate any in-flight peaks computation
    invalidatePeaks()

    setState(s => ({
      ...s,
      audioBlob: null,
      audioUrl: null,
      transcript: '',
      interimTranscript: '',
      error: null,
    }))
    setPlaybackMs(0)
    setAudioDurationMs(0)
    resetWaveform()

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      // Choose a supported audio mime type in order of preference
      const preferredTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/mp4', // last-resort for some Safari versions
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
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data)
      }
      mr.onstop = () => {
        const blobType = mr.mimeType || chosenType || ''
        const blob = new Blob(audioChunksRef.current, { type: blobType })
        const url = URL.createObjectURL(blob)
        setState(s => ({ ...s, audioBlob: blob, audioUrl: url }))
        setPlaybackMs(0)

        // Compute peaks for persistent waveform in playback
        computePeaksFromBlob(blob)
      }
      mediaRecorderRef.current = mr
      await setupWaveform(stream)
      mr.start()
      startTimer()
      startSpeechRecognition()
      setState(s => ({
        ...s,
        isRecording: true,
        error: null,
        durationMs: 0,
        interimTranscript: '',
      }))
      setHasEverRecorded(true)
    } catch (err) {
      let message =
        err instanceof Error ? err.message : 'Microphone permission denied or unavailable'

      // Provide more helpful error for mobile permission issues
      if (
        err instanceof Error &&
        (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
      ) {
        message =
          'Microphone access denied. Please allow microphone access in your browser settings.'
      } else if (err instanceof Error && err.name === 'NotFoundError') {
        message = 'No microphone found. Please connect a microphone and try again.'
      } else if (err instanceof Error && err.name === 'NotReadableError') {
        message =
          'Microphone is in use by another app. Please close other apps using the microphone.'
      }

      setState(s => ({ ...s, error: message }))
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stopRecording = () => {
    if (!state.isRecording) return
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
    setState(s => ({ ...s, isRecording: false }))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const discardRecording = () => {
    const el = audioRef.current
    if (el) {
      try {
        el.pause()
      } catch {
        /* noop */
      }
      el.currentTime = 0
    }
    stopRecording()

    if (state.audioUrl) URL.revokeObjectURL(state.audioUrl)
    setState(s => ({
      ...s,
      audioBlob: null,
      audioUrl: null,
      durationMs: 0,
      transcript: '',
      interimTranscript: '',
    }))
    setPlaybackMs(0)
    setAudioDurationMs(0)
    resetWaveform()
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Toggle recording handlers
  // ─────────────────────────────────────────────────────────────────────────────

  const micBtnRef = useRef<HTMLButtonElement>(null)

  const onMicClick = () => {
    if (state.isRecording) stopRecording()
    else startRecording()
  }

  const onMicKeyDown = (e: React.KeyboardEvent) => {
    // Only handle Enter (Space is reserved for playback toggle)
    if (e.code === 'Enter') {
      onMicClick()
      e.preventDefault()
    } else if (e.code === 'Escape' && !state.isRecording) {
      // Only discard when not recording
      discardRecording()
      e.preventDefault()
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Send
  // ─────────────────────────────────────────────────────────────────────────────

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onSend = async () => {
    if (!state.audioBlob) return
    setState(s => ({ ...s, isSending: true, error: null }))
    // Signal detection loading state to meter
    setLoading(true)
    try {
      const [prosodicResponse, lexicalResponse] = await Promise.all([
        sendProsodicAudio(state.audioBlob),
        state.transcript.trim()
          ? sendLexicalText(state.transcript.trim())
          : Promise.resolve({ id: 'no-text', value: 0, reliable: true }),
      ])
      // Pass both values to detection provider, including reliability info
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
      setState(s => ({ ...s, error: message }))
      // Reset loading state on error
      setLoading(false)
    } finally {
      setState(s => ({ ...s, isSending: false }))
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Audio preview / playback
  // ─────────────────────────────────────────────────────────────────────────────

  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackMs, setPlaybackMs] = useState(0)
  const [audioDurationMs, setAudioDurationMs] = useState(0)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const togglePlay = () => {
    const el = audioRef.current
    if (!el) return
    if (el.paused) {
      // If ended or at end, rewind to start before playing
      if (
        !Number.isNaN(el.duration) &&
        el.duration > 0 &&
        Math.abs(el.currentTime - el.duration) < 0.05
      ) {
        el.currentTime = 0
      }
      const playPromise = el.play()
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(() => setIsPlaying(true))
          .catch(err => {
            const name = (err as { name?: string } | undefined)?.name
            if (name === 'AbortError') return
            // Swallow other play() errors for now to avoid noisy console
          })
      }
    } else {
      el.pause()
    }
  }

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

    // Check if metadata is already loaded (e.g., when switching to modal view)
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
  }, [state.audioUrl])

  // Smooth clock updates during playback using rAF between timeupdate ticks
  useEffect(() => {
    let rafId: number | null = null
    const step = () => {
      const el = audioRef.current
      if (el && !el.paused) {
        setPlaybackMs(Math.max(0, el.currentTime * 1000))
        rafId = requestAnimationFrame(step)
      }
    }
    if (isPlaying) {
      rafId = requestAnimationFrame(step)
    }
    return () => {
      if (rafId != null) cancelAnimationFrame(rafId)
    }
  }, [isPlaying])

  const onSeekPercent = (percent: number) => {
    const el = audioRef.current
    if (!el) return
    if (!(audioDurationMs > 0)) return
    const newTime = clamp01(percent) * (audioDurationMs / 1000)
    el.currentTime = newTime
    setPlaybackMs(newTime * 1000)
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Global keyboard shortcuts
  // ─────────────────────────────────────────────────────────────────────────────

  // "R" key to toggle recording
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle "R" key
      if (e.code !== 'KeyR') return

      // Don't handle if any modifier keys are pressed (Cmd+R should refresh page)
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return

      // Don't interfere if user is typing in an input or textarea
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      // Don't toggle if playing audio or sending
      if (isPlaying || state.isSending) return

      e.preventDefault()
      if (state.isRecording) {
        stopRecording()
      } else {
        startRecording()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state.isRecording, state.isSending, isPlaying, startRecording, stopRecording])

  // Delete/Backspace key to discard recording
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle both Delete and Backspace (Backspace is the "delete" key on Mac)
      if (e.code !== 'Delete' && e.code !== 'Backspace') return

      // Don't interfere if user is typing in an input or textarea
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      // Only discard if there's audio to discard AND not currently recording or sending
      if (state.audioBlob && !state.isRecording && !state.isSending) {
        e.preventDefault()
        discardRecording()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state.audioBlob, state.isRecording, state.isSending, discardRecording])

  // Cmd/Ctrl+Enter to send
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle Cmd/Ctrl+Enter
      if (!((e.metaKey || e.ctrlKey) && e.key === 'Enter')) return

      // Don't interfere if user is typing in an input or textarea
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      // Only send if there's audio to send and not already sending
      if (state.audioBlob && !state.isSending) {
        e.preventDefault()
        onSend()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state.audioBlob, state.isSending, onSend])

  // Space bar to toggle playback
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle space bar
      if (e.code !== 'Space') return

      // Don't interfere if user is typing in an input or textarea
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      // Only toggle playback if there's audio to play (not for recording or sending)
      if (state.audioUrl && !state.isRecording && !state.isSending) {
        e.preventDefault() // Prevent page scroll
        togglePlay()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state.isRecording, state.isSending, state.audioUrl, togglePlay])

  return (
    <>
      <RecorderContent
        isRecording={state.isRecording}
        shouldFlashMic={!hasEverRecorded && !state.isRecording}
        durationLabel={
          state.isRecording ? formatDuration(state.durationMs) : formatDuration(playbackMs)
        }
        micRef={micBtnRef}
        canvasRef={canvasRef}
        audioRef={audioRef}
        audioSrc={state.audioUrl ?? undefined}
        speechSupported={speechSupported}
        transcript={state.transcript}
        interimTranscript={state.interimTranscript}
        isPlaying={isPlaying}
        canPlay={!!state.audioUrl}
        canDiscard={!!state.audioBlob && !state.isRecording}
        canSend={!!state.audioBlob}
        sending={state.isSending}
        showPlayhead={!state.isRecording && !!state.audioUrl}
        playheadPercent={
          audioDurationMs > 0 ? Math.min(1, Math.max(0, playbackMs / audioDurationMs)) : 0
        }
        isSeekEnabled={!state.isRecording && !!state.audioUrl}
        onSeekPercent={onSeekPercent}
        onMicClick={onMicClick}
        onMicKeyDown={onMicKeyDown}
        onTogglePlay={togglePlay}
        onDiscard={discardRecording}
        onSend={onSend}
      />
      <SpeechStatus
        status={speechStatus}
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
