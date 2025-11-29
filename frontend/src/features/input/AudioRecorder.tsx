import { useEffect, useRef, useState } from 'react'
// portal usage is encapsulated in MobileRecorderOverlay
import { sendLexicalText, sendProsodicAudio } from './apiService'
import { formatDuration, clamp01 } from './utils'
import { useRafInterval } from './hooks'
import RecorderContent from './components/RecorderContent'

type Nullable<T> = T | null

// Minimal typings for Web Speech API
type SpeechRecognitionLike = {
  interimResults: boolean
  continuous?: boolean
  maxAlternatives?: number
  lang: string
  onresult: (event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void
  onerror: (event: unknown) => void
  onend: () => void
  start: () => void
  stop: () => void
}

const getSpeechRecognitionCtor = (): (new () => SpeechRecognitionLike) | null => {
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

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

// extracted hooks are imported from ./hooks

const AudioRecorder = () => {

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

  const mediaRecorderRef = useRef<Nullable<MediaRecorder>>(null)
  const mediaStreamRef = useRef<Nullable<MediaStream>>(null)
  const audioChunksRef = useRef<BlobPart[]>([])
  const startTimeRef = useRef<number>(0)
  const timerIntervalRef = useRef<number | null>(null)
  const isRecordingRef = useRef<boolean>(false)

  // Waveform
  const audioContextRef = useRef<Nullable<AudioContext>>(null)
  const analyserRef = useRef<Nullable<AnalyserNode>>(null)
  const dataArrayRef = useRef<Nullable<Uint8Array>>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const lastWaveformRef = useRef<Uint8Array | null>(null)
  const peaksRef = useRef<{ min: Float32Array; max: Float32Array } | null>(null)
  const peaksComputationIdRef = useRef<number>(0)
  const decodingAudioContextRef = useRef<Nullable<AudioContext>>(null)

  const drawPathFromArray = (array: Uint8Array) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { width, height } = canvas
    ctx.clearRect(0, 0, width, height)
    ctx.lineWidth = 2
    ctx.strokeStyle = '#3b82f6'
    ctx.beginPath()
    const sliceWidth = width / array.length
    let x = 0
    for (let i = 0; i < array.length; i++) {
      const v = array[i] / 128.0
      const y = (v * height) / 2
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
      x += sliceWidth
    }
    ctx.lineTo(width, height / 2)
    ctx.stroke()
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  const drawPeaks = (min: Float32Array, max: Float32Array) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { width, height } = canvas
    ctx.clearRect(0, 0, width, height)

    const n = Math.min(min.length, max.length)
    const step = width / n

    // Fill shape between min and max
    ctx.beginPath()
    for (let i = 0; i < n; i++) {
      const x = i * step
      const yTop = (1 - max[i]) * height / 2
      if (i === 0) ctx.moveTo(x, yTop)
      else ctx.lineTo(x, yTop)
    }
    for (let i = n - 1; i >= 0; i--) {
      const x = i * step
      const yBot = (1 - min[i]) * height / 2
      ctx.lineTo(x, yBot)
    }
    ctx.closePath()
    ctx.fillStyle = 'rgba(59,130,246,0.25)'
    ctx.fill()

    // Draw outline on top
    ctx.beginPath()
    for (let i = 0; i < n; i++) {
      const x = i * step
      const y = (1 - max[i]) * height / 2
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 1
    ctx.stroke()
  }

  const drawWaveform = () => {
    const canvas = canvasRef.current
    const analyser = analyserRef.current
    const dataArray = dataArrayRef.current
    if (!canvas || !analyser || !dataArray) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { width, height } = canvas
    ctx.clearRect(0, 0, width, height)
    ctx.lineWidth = 2
    ctx.strokeStyle = '#3b82f6'
    // Use a temporary array to satisfy strict ArrayBuffer typing
    const temp = new Uint8Array(dataArray.length)
    analyser.getByteTimeDomainData(temp)
    dataArray.set(temp)
    lastWaveformRef.current = temp.slice()
    ctx.beginPath()
    const sliceWidth = width / dataArray.length
    let x = 0
    for (let i = 0; i < dataArray.length; i++) {
      const v = dataArray[i] / 128.0
      const y = (v * height) / 2
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
      x += sliceWidth
    }
    ctx.lineTo(width, height / 2)
    ctx.stroke()
  }

  useRafInterval(drawWaveform, state.isRecording)

  useEffect(() => {
    isRecordingRef.current = state.isRecording
  }, [state.isRecording])

  // Redraw static waveform when recording stops
  useEffect(() => {
    if (!state.isRecording) {
      if (peaksRef.current) drawPeaks(peaksRef.current.min, peaksRef.current.max)
      else if (lastWaveformRef.current) drawPathFromArray(lastWaveformRef.current)
      else clearCanvas()
    }
  }, [state.isRecording])

  // DPR sizing for canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.max(1, Math.floor(rect.width * dpr))
      canvas.height = Math.max(1, Math.floor(rect.height * dpr))
      // Redraw waveform after resize (canvas content is cleared when dimensions change)
      // Skip if recording - the RAF loop will handle it
      if (!state.isRecording) {
        if (peaksRef.current) drawPeaks(peaksRef.current.min, peaksRef.current.max)
        else if (lastWaveformRef.current) drawPathFromArray(lastWaveformRef.current)
        else clearCanvas()
      }
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [state.isRecording])

  // Cleanup blob URL on unmount to prevent memory leaks
  useEffect(() => {
    const currentUrl = state.audioUrl
    return () => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl)
      }
    }
  }, [state.audioUrl])

  // Cleanup decoding AudioContext on unmount
  useEffect(() => {
    return () => {
      if (decodingAudioContextRef.current && decodingAudioContextRef.current.state !== 'closed') {
        decodingAudioContextRef.current.close()
      }
    }
  }, [])

  const setupWaveform = async (stream: MediaStream) => {
    const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
    const AudioCtx = (w.AudioContext || w.webkitAudioContext) as typeof AudioContext
    const audioCtx = new AudioCtx()
    const source = audioCtx.createMediaStreamSource(stream)
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 2048
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    source.connect(analyser)
    try { await audioCtx.resume() } catch { /* noop */ }
    audioContextRef.current = audioCtx
    analyserRef.current = analyser
    dataArrayRef.current = dataArray
  }

  const cleanupWaveform = () => {
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    analyserRef.current = null
    dataArrayRef.current = null
  }

  // Shared AudioContext for decoding to avoid hitting browser limits
  const getDecodingAudioContext = () => {
    if (!decodingAudioContextRef.current || decodingAudioContextRef.current.state === 'closed') {
      const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
      const ACtor = (w.AudioContext || w.webkitAudioContext) as typeof AudioContext
      decodingAudioContextRef.current = new ACtor()
    }
    return decodingAudioContextRef.current
  }

  // Speech recognition
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const speechSupported = !!getSpeechRecognitionCtor()

  const startSpeechRecognition = () => {
    if (!speechSupported) return
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) return
    const recognition = new Ctor()
    recognition.interimResults = true
    recognition.continuous = true
    recognition.maxAlternatives = 1
    // Use browser's language setting with fallback to en-US
    recognition.lang = navigator.language || 'en-US'
    recognition.onresult = (event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const res = event.results[i]
        if (res.isFinal) final += res[0].transcript
        else interim += res[0].transcript
      }
      setState((s) => ({ ...s, interimTranscript: interim, transcript: s.transcript + final }))
    }
    recognition.onerror = (event: unknown) => {
      const errorEvent = event as { error?: string; message?: string }
      const errorType = errorEvent.error || 'unknown'
      
      // Only show user-facing errors for critical issues
      if (errorType === 'not-allowed' || errorType === 'service-not-allowed') {
        setState((s) => ({ ...s, error: 'Microphone permission denied for speech recognition' }))
      } else if (errorType === 'network') {
        setState((s) => ({ ...s, error: 'Network error: Speech recognition unavailable' }))
      } else if (errorType === 'no-speech') {
        // This is common and not critical, just log it
        console.warn('Speech recognition: No speech detected')
      } else if (errorType !== 'aborted') {
        // Log other errors but don't show to user (might be transient)
        console.warn('Speech recognition error:', errorType)
      }
    }
    recognition.onend = () => {
      if (isRecordingRef.current) {
        try { recognition.start() } catch { /* noop */ }
      } else {
        recognitionRef.current = null
      }
    }
    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch { /* noop */ }
  }

  const stopSpeechRecognition = () => {
    const rec = recognitionRef.current
    if (!rec) return
    try {
      rec.stop()
    } catch { /* noop */ }
    recognitionRef.current = null
  }

  // Timer - updates every 100ms to avoid excessive re-renders
  const startTimer = () => {
    startTimeRef.current = performance.now()
    const tick = () => {
      setState((s) => ({ ...s, durationMs: Math.max(0, performance.now() - startTimeRef.current) }))
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

  // Recording lifecycle
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const startRecording = async () => {
    if (state.isRecording) return
    
    // Clear previous recording if it exists
    if (state.audioUrl) {
      URL.revokeObjectURL(state.audioUrl)
    }
    // Invalidate any in-flight peaks computation
    peaksComputationIdRef.current += 1
    
    setState((s) => ({
      ...s,
      audioBlob: null,
      audioUrl: null,
      transcript: '',
      interimTranscript: '',
      error: null,
    }))
    setPlaybackMs(0)
    setAudioDurationMs(0)
    lastWaveformRef.current = null
    peaksRef.current = null
    clearCanvas()
    
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
      const chosenType = preferredTypes.find((t) => {
        try { return MediaRecorder.isTypeSupported(t) } catch { return false }
      }) || null
      const mr = new MediaRecorder(stream, chosenType ? { mimeType: chosenType } : undefined)
      audioChunksRef.current = []
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data)
      }
      mr.onstop = () => {
        const blobType = mr.mimeType || chosenType || ''
        const blob = new Blob(audioChunksRef.current, { type: blobType })
        const url = URL.createObjectURL(blob)
        setState((s) => ({ ...s, audioBlob: blob, audioUrl: url }))
        setPlaybackMs(0)
        
        // Increment computation ID to invalidate any in-flight peaks computation
        peaksComputationIdRef.current += 1
        const currentComputationId = peaksComputationIdRef.current
        
        // Decode and compute peaks for a persistent waveform in playback
        ;(async () => {
          try {
            const arrayBuf = await blob.arrayBuffer()
            
            // Check if this computation is still valid
            if (currentComputationId !== peaksComputationIdRef.current) return
            
            // Reuse shared AudioContext to avoid hitting browser limits
            const ac = getDecodingAudioContext()
            const audioBuffer = await ac.decodeAudioData(arrayBuf)
            
            // Check again after async operations
            if (currentComputationId !== peaksComputationIdRef.current) return
            
            const channels = audioBuffer.numberOfChannels
            const length = audioBuffer.length
            const data = new Float32Array(length)
            // Mixdown to mono
            for (let ch = 0; ch < channels; ch++) {
              const chData = audioBuffer.getChannelData(ch)
              for (let i = 0; i < length; i++) data[i] += chData[i] / channels
            }
            const bins = Math.max(512, Math.min(2048, Math.floor((canvasRef.current?.width || 1024) / 2)))
            const blockSize = Math.max(1, Math.floor(length / bins))
            const min = new Float32Array(bins)
            const max = new Float32Array(bins)
            for (let i = 0; i < bins; i++) {
              let blockMin = 1.0
              let blockMax = -1.0
              const start = i * blockSize
              const end = Math.min(start + blockSize, length)
              for (let j = start; j < end; j++) {
                const v = data[j]
                if (v < blockMin) blockMin = v
                if (v > blockMax) blockMax = v
              }
              min[i] = blockMin
              max[i] = blockMax
            }
            
            // Final check before updating refs and drawing
            if (currentComputationId !== peaksComputationIdRef.current) return
            
            peaksRef.current = { min, max }
            drawPeaks(min, max)
          } catch (err) {
            // Log but don't show user-facing error - peaks are optional for enhanced waveform
            // The recording/playback still works without them
            console.error('Failed to compute waveform peaks:', err)
          }
        })()
      }
      mediaRecorderRef.current = mr
      await setupWaveform(stream)
      mr.start()
      startTimer()
      startSpeechRecognition()
      setState((s) => ({ ...s, isRecording: true, error: null, durationMs: 0, interimTranscript: '' }))
      setHasEverRecorded(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Microphone permission denied or unavailable'
      setState((s) => ({ ...s, error: message }))
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stopRecording = () => {
    if (!state.isRecording) return
    const mr = mediaRecorderRef.current
    if (mr && mr.state !== 'inactive') mr.stop()
    mediaRecorderRef.current = null
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop())
      mediaStreamRef.current = null
    }
    cleanupWaveform()
    stopTimer()
    stopSpeechRecognition()
    setState((s) => ({ ...s, isRecording: false }))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const discardRecording = () => {
    const el = audioRef.current
    if (el) {
      try { el.pause() } catch { /* noop */ }
      el.currentTime = 0
    }
    stopRecording()
    
    // Invalidate any in-flight peaks computation
    peaksComputationIdRef.current += 1
    
    if (state.audioUrl) URL.revokeObjectURL(state.audioUrl)
    setState((s) => ({
      ...s,
      audioBlob: null,
      audioUrl: null,
      durationMs: 0,
      transcript: '',
      interimTranscript: '',
    }))
    setPlaybackMs(0)
    setAudioDurationMs(0)
    lastWaveformRef.current = null
    peaksRef.current = null
    clearCanvas()
  }

  // Toggle recording handlers
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

  // Send
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onSend = async () => {
    if (!state.audioBlob) return
    setState((s) => ({ ...s, isSending: true, error: null }))
    try {
      await Promise.all([
        sendProsodicAudio(state.audioBlob),
        state.transcript.trim() ? sendLexicalText(state.transcript.trim()) : Promise.resolve({ id: 'no-text' }),
      ])
      // Successfully sent - discard the recording to allow a new one
      discardRecording()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send'
      setState((s) => ({ ...s, error: message }))
    } finally {
      setState((s) => ({ ...s, isSending: false }))
    }
  }

  // Preview
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
      if (!Number.isNaN(el.duration) && el.duration > 0 && Math.abs(el.currentTime - el.duration) < 0.05) {
        el.currentTime = 0
      }
      const playPromise = el.play()
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(() => setIsPlaying(true))
          .catch((err) => {
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

  // Global keyboard handler for "R" key to toggle recording
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

  // Global keyboard handler for Delete/Backspace key to discard recording
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

  // Global keyboard handler for Cmd/Ctrl+Enter to send
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

  // Global keyboard handler for space bar to toggle playback
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
        durationLabel={state.isRecording ? formatDuration(state.durationMs) : formatDuration(playbackMs)}
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
        playheadPercent={audioDurationMs > 0 ? Math.min(1, Math.max(0, playbackMs / audioDurationMs)) : 0}
        isSeekEnabled={!state.isRecording && !!state.audioUrl}
        onSeekPercent={onSeekPercent}
        onMicClick={onMicClick}
        onMicKeyDown={onMicKeyDown}
        onTogglePlay={togglePlay}
        onDiscard={discardRecording}
        onSend={onSend}
      />
      {state.error && <div className="audio-recorder__error" role="alert">{state.error}</div>}
    </>
  )
}

export default AudioRecorder


