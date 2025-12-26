import { useCallback, useEffect, useRef, useState } from 'react'
import { clamp01 } from '../utils'

type Nullable<T> = T | null

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type AudioRecorderState = {
  isRecording: boolean
  audioBlob: Nullable<Blob>
  audioUrl: Nullable<string>
  durationMs: number
  transcript: string
  interimTranscript: string
  error: Nullable<string>
}

export type PlaybackState = {
  isPlaying: boolean
  playbackMs: number
  audioDurationMs: number
}

type WaveformControls = {
  setupWaveform: (stream: MediaStream) => Promise<void>
  cleanupWaveform: () => void
  invalidatePeaks: () => void
  computePeaksFromBlob: (blob: Blob) => void
  resetWaveform: () => void
}

type SpeechControls = {
  startSpeechRecognition: () => void
  stopSpeechRecognition: () => void
}

export type UseAudioRecorderOptions = {
  /** Waveform controls from useWaveform hook */
  waveformControls: WaveformControls
  /** Speech recognition controls from useSpeechRecognition hook */
  speechControls: SpeechControls
  /** Callback when recording successfully starts */
  onRecordingStart?: () => void
}

export type UseAudioRecorderReturn = {
  // State
  state: AudioRecorderState
  playback: PlaybackState
  isRecordingRef: React.MutableRefObject<boolean>

  // Audio element ref - must be attached to an <audio> element
  audioRef: React.RefObject<HTMLAudioElement | null>

  // Recording controls
  startRecording: () => Promise<void>
  stopRecording: () => void
  discardRecording: () => void

  // Playback controls
  togglePlay: () => void
  handleSeek: (percent: number) => void

  // Transcript controls
  updateTranscript: (update: { interim: string; final: string }) => void
  setError: (error: string | null) => void

  // Derived state
  canPlay: boolean
  canDiscard: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook Implementation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook for managing audio recording and playback.
 *
 * Encapsulates:
 * - Recording state and lifecycle (start, stop, discard)
 * - Timer for recording duration
 * - Playback state and controls
 * - Audio element event binding
 *
 * Must be used with:
 * - useWaveform hook for waveform visualization
 * - useSpeechRecognition hook for speech-to-text
 */
export function useAudioRecorder({
  waveformControls,
  speechControls,
  onRecordingStart,
}: UseAudioRecorderOptions): UseAudioRecorderReturn {
  const { setupWaveform, cleanupWaveform, invalidatePeaks, computePeaksFromBlob, resetWaveform } =
    waveformControls
  const { startSpeechRecognition, stopSpeechRecognition } = speechControls

  // ─────────────────────────────────────────────────────────────────────────
  // Recording State
  // ─────────────────────────────────────────────────────────────────────────

  const [state, setState] = useState<AudioRecorderState>({
    isRecording: false,
    audioBlob: null,
    audioUrl: null,
    durationMs: 0,
    transcript: '',
    interimTranscript: '',
    error: null,
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Playback State
  // ─────────────────────────────────────────────────────────────────────────

  const [playback, setPlayback] = useState<PlaybackState>({
    isPlaying: false,
    playbackMs: 0,
    audioDurationMs: 0,
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Refs
  // ─────────────────────────────────────────────────────────────────────────

  const mediaRecorderRef = useRef<Nullable<MediaRecorder>>(null)
  const mediaStreamRef = useRef<Nullable<MediaStream>>(null)
  const audioChunksRef = useRef<BlobPart[]>([])
  const startTimeRef = useRef<number>(0)
  const timerIntervalRef = useRef<number | null>(null)
  const isRecordingRef = useRef<boolean>(false)
  const isStartingRecordingRef = useRef<boolean>(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  // Keep isRecordingRef in sync with state
  useEffect(() => {
    isRecordingRef.current = state.isRecording
  }, [state.isRecording])

  // ─────────────────────────────────────────────────────────────────────────
  // Cleanup blob URL on unmount
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const currentUrl = state.audioUrl
    return () => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl)
      }
    }
  }, [state.audioUrl])

  // ─────────────────────────────────────────────────────────────────────────
  // Timer Functions
  // ─────────────────────────────────────────────────────────────────────────

  const startTimer = useCallback(() => {
    startTimeRef.current = performance.now()
    const tick = () => {
      setState(s => ({ ...s, durationMs: Math.max(0, performance.now() - startTimeRef.current) }))
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

  // ─────────────────────────────────────────────────────────────────────────
  // Recording Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    // Use ref to prevent race conditions from rapid calls
    if (state.isRecording || isStartingRecordingRef.current) {
      return
    }

    // Set flag synchronously to prevent concurrent getUserMedia calls
    isStartingRecordingRef.current = true

    // Check for mediaDevices support
    if (!navigator.mediaDevices?.getUserMedia) {
      isStartingRecordingRef.current = false
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
    invalidatePeaks()

    setState(s => ({
      ...s,
      audioBlob: null,
      audioUrl: null,
      transcript: '',
      interimTranscript: '',
      error: null,
    }))
    setPlayback({ isPlaying: false, playbackMs: 0, audioDurationMs: 0 })
    resetWaveform()

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // Check again after async operation - another call may have started
      if (isRecordingRef.current || mediaStreamRef.current) {
        stream.getTracks().forEach(track => track.stop())
        isStartingRecordingRef.current = false
        return
      }

      mediaStreamRef.current = stream

      // Choose a supported audio mime type in order of preference
      const preferredTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg',
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
        const blobType = mr.mimeType || chosenType || ''
        const blob = new Blob(audioChunksRef.current, { type: blobType })
        const url = URL.createObjectURL(blob)
        setState(s => ({ ...s, audioBlob: blob, audioUrl: url }))
        setPlayback(p => ({ ...p, playbackMs: 0 }))
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
      isStartingRecordingRef.current = false
      onRecordingStart?.()
    } catch (err) {
      isStartingRecordingRef.current = false
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
  }, [
    state.isRecording,
    state.audioUrl,
    invalidatePeaks,
    resetWaveform,
    setupWaveform,
    startTimer,
    startSpeechRecognition,
    computePeaksFromBlob,
    onRecordingStart,
  ])

  const stopRecording = useCallback(() => {
    if (!state.isRecording) return

    // Stop speech recognition FIRST to release any microphone access it may have
    stopSpeechRecognition()

    const mr = mediaRecorderRef.current
    if (mr && mr.state !== 'inactive') mr.stop()
    mediaRecorderRef.current = null

    // Stop MediaStream tracks after speech recognition is stopped
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop())
      mediaStreamRef.current = null
    }

    cleanupWaveform()
    stopTimer()
    setState(s => ({ ...s, isRecording: false }))
    isStartingRecordingRef.current = false
  }, [state.isRecording, cleanupWaveform, stopTimer, stopSpeechRecognition])

  const discardRecording = useCallback(() => {
    const el = audioRef.current
    if (el) {
      try {
        el.pause()
      } catch {
        /* noop */
      }
      el.currentTime = 0
    }

    // Stop recording if active
    if (state.isRecording) {
      // Stop speech recognition FIRST to release any microphone access it may have
      stopSpeechRecognition()

      const mr = mediaRecorderRef.current
      if (mr && mr.state !== 'inactive') mr.stop()
      mediaRecorderRef.current = null

      // Stop MediaStream tracks after speech recognition is stopped
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop())
        mediaStreamRef.current = null
      }

      cleanupWaveform()
      stopTimer()
    }

    if (state.audioUrl) URL.revokeObjectURL(state.audioUrl)

    setState(s => ({
      ...s,
      isRecording: false,
      audioBlob: null,
      audioUrl: null,
      durationMs: 0,
      transcript: '',
      interimTranscript: '',
    }))
    setPlayback({ isPlaying: false, playbackMs: 0, audioDurationMs: 0 })
    resetWaveform()
    isStartingRecordingRef.current = false
  }, [
    state.isRecording,
    state.audioUrl,
    cleanupWaveform,
    stopTimer,
    stopSpeechRecognition,
    resetWaveform,
  ])

  // ─────────────────────────────────────────────────────────────────────────
  // Playback Controls
  // ─────────────────────────────────────────────────────────────────────────

  const togglePlay = useCallback(() => {
    const el = audioRef.current
    if (!el || !state.audioUrl) return

    if (el.paused) {
      // If ended or at end, rewind to start before playing
      if (
        !Number.isNaN(el.duration) &&
        el.duration > 0 &&
        Math.abs(el.currentTime - el.duration) < 0.05
      ) {
        el.currentTime = 0
      }
      el.play()
        .then(() => setPlayback(p => ({ ...p, isPlaying: true })))
        .catch(() => {
          // Swallow play() errors (e.g., AbortError)
        })
    } else {
      el.pause()
    }
  }, [state.audioUrl])

  const handleSeek = useCallback(
    (percent: number) => {
      const el = audioRef.current
      if (!el) return
      if (!(playback.audioDurationMs > 0)) return
      const newTime = clamp01(percent) * (playback.audioDurationMs / 1000)
      el.currentTime = newTime
      setPlayback(p => ({ ...p, playbackMs: newTime * 1000 }))
    },
    [playback.audioDurationMs]
  )

  // ─────────────────────────────────────────────────────────────────────────
  // Audio Element Event Binding
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const el = audioRef.current
    if (!el) return

    const onEnded = () => setPlayback(p => ({ ...p, isPlaying: false }))
    const onPlay = () => setPlayback(p => ({ ...p, isPlaying: true }))
    const onPause = () => setPlayback(p => ({ ...p, isPlaying: false }))
    const onTimeUpdate = () =>
      setPlayback(p => ({ ...p, playbackMs: Math.max(0, el.currentTime * 1000) }))
    const onLoadedMetadata = () => {
      setPlayback(p => ({
        ...p,
        playbackMs: 0,
        audioDurationMs: Number.isFinite(el.duration) ? el.duration * 1000 : 0,
      }))
    }
    const onSeeked = () =>
      setPlayback(p => ({ ...p, playbackMs: Math.max(0, el.currentTime * 1000) }))

    // Check if metadata is already loaded
    if (el.readyState >= 1 && Number.isFinite(el.duration) && el.duration > 0) {
      setPlayback(p => ({ ...p, audioDurationMs: el.duration * 1000 }))
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

  // Smooth clock updates during playback using rAF
  useEffect(() => {
    let rafId: number | null = null
    const step = () => {
      const el = audioRef.current
      if (el && !el.paused) {
        setPlayback(p => ({ ...p, playbackMs: Math.max(0, el.currentTime * 1000) }))
        rafId = requestAnimationFrame(step)
      }
    }
    if (playback.isPlaying) {
      rafId = requestAnimationFrame(step)
    }
    return () => {
      if (rafId != null) cancelAnimationFrame(rafId)
    }
  }, [playback.isPlaying])

  // ─────────────────────────────────────────────────────────────────────────
  // Transcript Updates
  // ─────────────────────────────────────────────────────────────────────────

  const updateTranscript = useCallback(({ interim, final }: { interim: string; final: string }) => {
    setState(s => ({
      ...s,
      interimTranscript: interim,
      transcript: s.transcript + final,
    }))
  }, [])

  const setError = useCallback((error: string | null) => {
    setState(s => ({ ...s, error }))
  }, [])

  // ─────────────────────────────────────────────────────────────────────────
  // Cleanup on unmount
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      // Stop timer if running
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
      // Note: stopSpeechRecognition and cleanupWaveform should be called by parent
      isStartingRecordingRef.current = false
    }
  }, [])

  // ─────────────────────────────────────────────────────────────────────────
  // Derived State
  // ─────────────────────────────────────────────────────────────────────────

  const canPlay = !!state.audioUrl && !state.isRecording
  const canDiscard = !!state.audioBlob && !state.isRecording

  return {
    state,
    playback,
    isRecordingRef,
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
  }
}
