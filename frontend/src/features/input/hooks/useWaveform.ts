import { useCallback, useEffect, useRef } from 'react'
import { useRafInterval } from '../hooks'
import { isDev } from '../utils/env'

type Nullable<T> = T | null

type Peaks = {
  min: Float32Array
  max: Float32Array
}

type UseWaveformOptions = {
  /** Whether recording is currently active (drives live waveform animation) */
  isRecording: boolean
}

/**
 * Hook for managing audio waveform visualization on a canvas.
 * Handles:
 * - Live waveform drawing during recording (via Web Audio API analyser)
 * - Static peaks-based waveform for playback
 * - Canvas DPR scaling and resize handling
 * - Decoding audio blobs to compute min/max peaks
 */
export function useWaveform({ isRecording }: UseWaveformOptions) {
  // Canvas ref - must be attached to the canvas element
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Web Audio API refs for live waveform
  const audioContextRef = useRef<Nullable<AudioContext>>(null)
  const analyserRef = useRef<Nullable<AnalyserNode>>(null)
  const gainNodeRef = useRef<Nullable<GainNode>>(null) // For boosting quiet signals
  const dataArrayRef = useRef<Nullable<Uint8Array>>(null)

  // Waveform data refs
  const lastWaveformRef = useRef<Uint8Array | null>(null)
  const peaksRef = useRef<Peaks | null>(null)
  const peaksComputationIdRef = useRef<number>(0)

  // Range-based noise gate + auto-gain for consistent waveform display across browsers
  // Chrome often has very low amplitude (range 1-2), Firefox has higher (range 20-50+)
  // We use range (max-min) to detect signal vs noise and apply appropriate gain
  const currentGainRef = useRef<number>(1.0) // Current display gain (smoothed)

  // Shared AudioContext for decoding (avoids hitting browser limits)
  const decodingAudioContextRef = useRef<Nullable<AudioContext>>(null)

  // Keep isRecording in a ref for use in RAF callback
  const isRecordingRef = useRef(isRecording)
  useEffect(() => {
    isRecordingRef.current = isRecording
  }, [isRecording])

  // ─────────────────────────────────────────────────────────────────────────────
  // Drawing functions
  // ─────────────────────────────────────────────────────────────────────────────

  const drawPathFromArray = useCallback((array: Uint8Array) => {
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
  }, [])

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }, [])

  const drawPeaks = useCallback((min: Float32Array, max: Float32Array) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { width, height } = canvas
    ctx.clearRect(0, 0, width, height)

    const n = Math.min(min.length, max.length)
    const step = width / n

    // ─────────────────────────────────────────────────────────────────────────
    // Normalize peaks to fill canvas (fixes flat waveforms on quiet recordings)
    // But don't over-amplify very quiet recordings (noise)
    // ─────────────────────────────────────────────────────────────────────────
    let peakAmplitude = 0
    for (let i = 0; i < n; i++) {
      peakAmplitude = Math.max(peakAmplitude, Math.abs(min[i]), Math.abs(max[i]))
    }

    // Noise gate: very quiet recordings (peak < 0.05) get minimal amplification
    // This prevents amplifying noise in recordings
    const NOISE_THRESHOLD = 0.03 // ~3% of full scale is noise
    const TARGET_AMPLITUDE = 0.6 // Target 60% of half-height (reduced from 80%)

    let normScale = 1.0
    if (peakAmplitude > NOISE_THRESHOLD) {
      // Above noise floor - calculate normalization
      const idealScale = TARGET_AMPLITUDE / peakAmplitude
      // Compress high scales with sqrt, but cap lower to prevent peaking
      const MAX_SCALE = 5 // Reduced from 10
      normScale = Math.min(Math.sqrt(idealScale) * 1.5, MAX_SCALE)
      // Never reduce loud audio
      normScale = Math.max(normScale, 1.0)
    }
    // else: stay at 1.0 (noise - no amplification)

    // Fill shape between min and max (with normalization)
    ctx.beginPath()
    for (let i = 0; i < n; i++) {
      const x = i * step
      const normalizedMax = max[i] * normScale
      const yTop = ((1 - normalizedMax) * height) / 2
      if (i === 0) ctx.moveTo(x, yTop)
      else ctx.lineTo(x, yTop)
    }
    for (let i = n - 1; i >= 0; i--) {
      const x = i * step
      const normalizedMin = min[i] * normScale
      const yBot = ((1 - normalizedMin) * height) / 2
      ctx.lineTo(x, yBot)
    }
    ctx.closePath()
    ctx.fillStyle = 'rgba(59,130,246,0.25)'
    ctx.fill()

    // Draw outline on top (with normalization)
    ctx.beginPath()
    for (let i = 0; i < n; i++) {
      const x = i * step
      const normalizedMax = max[i] * normScale
      const y = ((1 - normalizedMax) * height) / 2
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 1
    ctx.stroke()
  }, [])

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current
    const analyser = analyserRef.current
    const dataArray = dataArrayRef.current
    const gainNode = gainNodeRef.current
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

    // ─────────────────────────────────────────────────────────────────────────
    // Auto-Gain Normalization with Smooth Noise Floor:
    // Chrome produces VERY quiet audio (deviation 1-2 for speech!)
    // Firefox produces louder audio (deviation 20-50+)
    //
    // Strategy: Continuous gain curve that ramps up smoothly
    // - Very low deviation (1-2): Low gain (1-3x) - mostly noise, slight boost
    // - Medium deviation (3-10): Medium gain (3-6x) - Chrome speech
    // - High deviation (10+): Minimal gain (1-2x) - Firefox speech
    // ─────────────────────────────────────────────────────────────────────────

    // Find min/max to calculate deviation from center (128)
    let minVal = 255,
      maxVal = 0
    for (let i = 0; i < temp.length; i++) {
      if (temp[i] < minVal) minVal = temp[i]
      if (temp[i] > maxVal) maxVal = temp[i]
    }

    const maxDeviation = Math.max(maxVal - 128, 128 - minVal, 1) // Avoid division by zero

    // Target: waveform fills ~40% of canvas height
    const TARGET_PEAK_DEVIATION = height * 0.2 // 20% above/below center = 40% total

    // Calculate base gain needed
    const baseGain = TARGET_PEAK_DEVIATION / maxDeviation

    // Apply gain curve based on deviation level:
    // - Low deviation: allow higher gain (Chrome needs it)
    // - High deviation: cap gain lower (Firefox doesn't need much)
    let maxAllowedGain: number
    if (maxDeviation <= 2) {
      // Very quiet (Chrome noise/quiet speech): allow up to 8x
      maxAllowedGain = 8
    } else if (maxDeviation <= 5) {
      // Quiet (Chrome speech): allow up to 6x
      maxAllowedGain = 6
    } else if (maxDeviation <= 15) {
      // Medium: allow up to 4x
      maxAllowedGain = 4
    } else {
      // Loud (Firefox): allow up to 2x
      maxAllowedGain = 2
    }

    // Apply sqrt compression then cap
    const compressedGain = Math.sqrt(baseGain) * 1.5
    const displayGain = Math.max(Math.min(compressedGain, maxAllowedGain), 1.0)

    // Smooth the gain changes
    currentGainRef.current += (displayGain - currentGainRef.current) * 0.1

    // Update the Web Audio GainNode
    if (gainNode) {
      gainNode.gain.value = Math.max(currentGainRef.current, 1.0)
    }

    // Use smoothed gain for display
    const finalGain = currentGainRef.current

    // Draw the waveform with applied gain
    ctx.beginPath()
    const sliceWidth = width / dataArray.length
    let x = 0
    for (let i = 0; i < dataArray.length; i++) {
      // Center around 128, apply smoothed gain, then offset to canvas center
      const deviation = (dataArray[i] - 128) * finalGain
      // Clamp to prevent drawing outside canvas
      const clampedDeviation = Math.max(-height / 2, Math.min(height / 2, deviation))
      const y = height / 2 - clampedDeviation
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
      x += sliceWidth
    }
    ctx.lineTo(width, height / 2)
    ctx.stroke()
  }, [])

  // RAF loop for live waveform during recording
  useRafInterval(drawWaveform, isRecording)

  // ─────────────────────────────────────────────────────────────────────────────
  // Redraw static waveform when recording stops
  // ─────────────────────────────────────────────────────────────────────────────

  const redrawStaticWaveform = useCallback(() => {
    if (peaksRef.current) {
      drawPeaks(peaksRef.current.min, peaksRef.current.max)
    } else if (lastWaveformRef.current) {
      drawPathFromArray(lastWaveformRef.current)
    } else {
      clearCanvas()
    }
  }, [drawPeaks, drawPathFromArray, clearCanvas])

  useEffect(() => {
    if (!isRecording) {
      redrawStaticWaveform()
    }
  }, [isRecording, redrawStaticWaveform])

  // ─────────────────────────────────────────────────────────────────────────────
  // DPR sizing for canvas
  // ─────────────────────────────────────────────────────────────────────────────

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
      if (!isRecordingRef.current) {
        if (peaksRef.current) {
          drawPeaks(peaksRef.current.min, peaksRef.current.max)
        } else if (lastWaveformRef.current) {
          drawPathFromArray(lastWaveformRef.current)
        } else {
          clearCanvas()
        }
      }
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [drawPeaks, drawPathFromArray, clearCanvas])

  // ─────────────────────────────────────────────────────────────────────────────
  // Cleanup decoding AudioContext on unmount
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (decodingAudioContextRef.current && decodingAudioContextRef.current.state !== 'closed') {
        decodingAudioContextRef.current.close()
      }
    }
  }, [])

  // ─────────────────────────────────────────────────────────────────────────────
  // Setup / cleanup for live waveform
  // ─────────────────────────────────────────────────────────────────────────────

  const setupWaveform = useCallback(async (stream: MediaStream) => {
    const w = window as unknown as {
      AudioContext?: typeof AudioContext
      webkitAudioContext?: typeof AudioContext
    }
    const AudioCtx = (w.AudioContext || w.webkitAudioContext) as typeof AudioContext
    const audioCtx = new AudioCtx()
    const source = audioCtx.createMediaStreamSource(stream)

    // Create a GainNode to boost quiet signals (especially on Chrome)
    // This is placed between the source and analyser to amplify before analysis
    const gainNode = audioCtx.createGain()
    gainNode.gain.value = 1.0 // Start at 1x, will be adjusted dynamically

    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 2048
    // Adjust the analyser's decibel range for better sensitivity
    // Default is -100 to -30, we use a wider range for quiet signals
    analyser.minDecibels = -90
    analyser.maxDecibels = -10

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    // Chain: source -> gainNode -> analyser
    source.connect(gainNode)
    gainNode.connect(analyser)

    try {
      await audioCtx.resume()
    } catch {
      /* noop */
    }
    audioContextRef.current = audioCtx
    analyserRef.current = analyser
    gainNodeRef.current = gainNode
    dataArrayRef.current = dataArray

    // Reset auto-gain for new recording
    currentGainRef.current = 1.0
  }, [])

  const cleanupWaveform = useCallback(() => {
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    analyserRef.current = null
    gainNodeRef.current = null
    dataArrayRef.current = null
  }, [])

  // ─────────────────────────────────────────────────────────────────────────────
  // Peaks computation from audio blob
  // ─────────────────────────────────────────────────────────────────────────────

  const getDecodingAudioContext = useCallback(() => {
    if (!decodingAudioContextRef.current || decodingAudioContextRef.current.state === 'closed') {
      const w = window as unknown as {
        AudioContext?: typeof AudioContext
        webkitAudioContext?: typeof AudioContext
      }
      const ACtor = (w.AudioContext || w.webkitAudioContext) as typeof AudioContext
      decodingAudioContextRef.current = new ACtor()
    }
    return decodingAudioContextRef.current
  }, [])

  /**
   * Invalidate any in-flight peaks computation (call before starting a new recording
   * or when discarding)
   */
  const invalidatePeaks = useCallback(() => {
    peaksComputationIdRef.current += 1
  }, [])

  /**
   * Compute peaks from an audio blob and draw them on the canvas.
   * This is async and respects invalidation (won't draw if a newer computation started).
   */
  const computePeaksFromBlob = useCallback(
    async (blob: Blob) => {
      // Increment computation ID to invalidate any in-flight computation
      peaksComputationIdRef.current += 1
      const currentComputationId = peaksComputationIdRef.current

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
        const bins = Math.max(
          512,
          Math.min(2048, Math.floor((canvasRef.current?.width || 1024) / 2))
        )
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
        if (isDev()) console.error('Failed to compute waveform peaks:', err)
      }
    },
    [getDecodingAudioContext, drawPeaks]
  )

  /**
   * Reset all waveform state (call when discarding a recording)
   */
  const resetWaveform = useCallback(() => {
    invalidatePeaks()
    lastWaveformRef.current = null
    peaksRef.current = null
    // Reset auto-gain for next recording
    currentGainRef.current = 1.0
    clearCanvas()
  }, [invalidatePeaks, clearCanvas])

  return {
    // Refs
    canvasRef,
    peaksRef,
    lastWaveformRef,

    // Setup/cleanup for live recording
    setupWaveform,
    cleanupWaveform,

    // Drawing
    clearCanvas,
    drawPeaks,
    redrawStaticWaveform,

    // Peaks computation
    invalidatePeaks,
    computePeaksFromBlob,

    // Full reset
    resetWaveform,
  }
}
