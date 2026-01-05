import { useCallback, useEffect, useRef } from 'react'
import { useRafInterval } from '../hooks'
import { isDev } from '../utils/env'

// ─────────────────────────────────────────────────────────────────────────────
// Auto-Gain Normalization Constants
// ─────────────────────────────────────────────────────────────────────────────
//
// These thresholds address a significant browser discrepancy in Web Audio API
// behavior. When reading audio data via AnalyserNode.getByteTimeDomainData():
//
// - Chrome produces VERY quiet audio signals:
//   • Silence/noise: deviation 0-2 from center (128)
//   • Normal speech: deviation 2-10 from center
//   • Loud speech: deviation 10-15 from center
//
// - Firefox produces much louder audio signals:
//   • Silence/noise: deviation 0-5 from center
//   • Normal speech: deviation 20-50 from center
//   • Loud speech: deviation 50+ from center
//
// Without normalization, Chrome waveforms appear nearly flat while Firefox
// waveforms fill the canvas. The strategy below applies higher gain to quieter
// signals (Chrome) and lower gain to louder signals (Firefox) to achieve
// consistent visual amplitude across browsers.
//
// Values were determined empirically by testing on Chrome 120+ and Firefox 120+
// with various microphones (built-in laptop, USB headset, professional condenser).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Audio deviation thresholds (from center value of 128 in Uint8 [0-255] range).
 * These define the boundaries between noise/quiet/medium/loud signal levels.
 */
const DEVIATION_THRESHOLDS = {
  /**
   * Max deviation for "very quiet" signals (likely noise or very quiet Chrome audio).
   * Chrome speech typically starts above this threshold.
   */
  VERY_QUIET: 2,

  /**
   * Max deviation for "quiet" signals (typical Chrome speech range).
   * Chrome normal speech falls in the 2-5 range.
   */
  QUIET: 5,

  /**
   * Max deviation for "medium" signals (loud Chrome or quiet Firefox).
   * Firefox normal speech typically exceeds this.
   */
  MEDIUM: 15,
} as const

/**
 * Maximum gain multipliers for each signal level.
 * Higher gain for quiet signals (Chrome), lower for loud signals (Firefox).
 *
 * The asymmetric values compensate for the ~10-20x amplitude difference
 * between Chrome and Firefox audio data.
 */
const MAX_GAIN_BY_LEVEL = {
  /**
   * Very quiet signals (deviation ≤ 2): Allow up to 8x gain.
   * Provides significant boost for Chrome's quiet output while avoiding
   * over-amplification of pure noise (which stays below this threshold).
   */
  VERY_QUIET: 8,

  /**
   * Quiet signals (deviation ≤ 5): Allow up to 6x gain.
   * Typical Chrome speech range - moderate boost to fill canvas.
   */
  QUIET: 6,

  /**
   * Medium signals (deviation ≤ 15): Allow up to 4x gain.
   * Covers loud Chrome speech and quiet Firefox speech.
   */
  MEDIUM: 4,

  /**
   * Loud signals (deviation > 15): Allow up to 2x gain.
   * Firefox typically falls here - minimal boost needed as signal is already strong.
   */
  LOUD: 2,
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Gain Smoothing Configuration
// ─────────────────────────────────────────────────────────────────────────────
//
// Exponential smoothing is used to prevent jarring jumps in the waveform display.
// The formula: currentGain += (targetGain - currentGain) * α
//
// With requestAnimationFrame (~60fps, 16.7ms per frame):
// - α=0.3 → 63% of target in ~3 frames (~50ms), 95% in ~10 frames (~167ms)
// - α=0.1 → 63% of target in ~10 frames (~167ms), 95% in ~30 frames (~500ms)
//
// Trade-off: Higher α = more responsive but potentially jittery
//            Lower α = smoother but can feel sluggish
//
// We use ADAPTIVE smoothing: fast attack (silence→speech) for responsiveness,
// slower release (speech→silence) for visual smoothness.
// ─────────────────────────────────────────────────────────────────────────────

const GAIN_SMOOTHING = {
  /**
   * Attack factor: Used when target gain > current gain (audio getting louder).
   * Higher value = faster response to speech onset.
   * At 60fps: 0.3 reaches 95% of target in ~170ms
   */
  ATTACK: 0.3,

  /**
   * Release factor: Used when target gain < current gain (audio getting quieter).
   * Lower value = smoother decay, prevents jitter during natural speech pauses.
   * At 60fps: 0.08 reaches 95% of target in ~600ms
   */
  RELEASE: 0.08,
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Gain Compression Configuration
// ─────────────────────────────────────────────────────────────────────────────
//
// We apply sqrt compression to the calculated gain to reduce dynamic range.
// This mimics human auditory perception (Weber-Fechner law) where perceived
// loudness is roughly logarithmic. Without compression:
//   - A 4x quieter signal needs 4x gain → jarring visual jumps
//   - A 16x quieter signal needs 16x gain → extreme amplification
//
// With sqrt compression:
//   - 4x quieter → sqrt(4) = 2x compressed gain (smoother)
//   - 16x quieter → sqrt(16) = 4x compressed gain (still manageable)
//
// The VISIBILITY_BOOST compensates for sqrt's gain reduction on typical signals.
// At baseGain=4 (common for Chrome speech): sqrt(4) * 1.5 = 3x effective gain.
// This was empirically tuned to fill ~50-60% of canvas height on typical speech.
// ─────────────────────────────────────────────────────────────────────────────

const GAIN_COMPRESSION = {
  /**
   * Visibility boost multiplier applied after sqrt compression.
   *
   * Rationale: sqrt compression reduces gain (e.g., sqrt(4)=2 instead of 4).
   * This multiplier compensates to ensure typical speech fills the canvas well.
   *
   * Examples with VISIBILITY_BOOST = 1.5:
   *   baseGain 1  → sqrt(1) * 1.5 = 1.5x  (slight boost for already-good signals)
   *   baseGain 4  → sqrt(4) * 1.5 = 3.0x  (moderate boost for quiet Chrome speech)
   *   baseGain 16 → sqrt(16) * 1.5 = 6.0x (strong boost, but not extreme 16x)
   *
   * Trade-off: Higher value = more visible waveforms, risk of clipping
   *            Lower value = subtler waveforms, may appear flat on quiet audio
   */
  VISIBILITY_BOOST: 1.5,
} as const

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
    // Chrome recordings can be VERY quiet (~0.05 peak), so we use normalization.
    //
    // However, we must avoid amplifying noise on truly silent recordings.
    // Trade-off: Too high a threshold = quiet speech looks flat
    //            Too low a threshold = background noise gets amplified
    // ─────────────────────────────────────────────────────────────────────────
    let peakAmplitude = 0
    for (let i = 0; i < n; i++) {
      peakAmplitude = Math.max(peakAmplitude, Math.abs(min[i]), Math.abs(max[i]))
    }

    // Normalization constants
    const TARGET_AMPLITUDE = 0.6 // Target: waveform fills ~60% of canvas height
    const MAX_SCALE = 15 // Maximum scaling factor (reduced from 30 to limit noise amplification)
    const NOISE_FLOOR = 0.01 // Minimum peak amplitude (1% of full scale) below which we assume noise

    let normScale = 1.0
    if (peakAmplitude >= NOISE_FLOOR) {
      // Signal is above noise floor - apply normalization
      const idealScale = TARGET_AMPLITUDE / peakAmplitude
      normScale = Math.min(idealScale, MAX_SCALE)
      normScale = Math.max(normScale, 1.0)
    } else if (peakAmplitude > 0.001) {
      // Signal is between 0.1% and 1% - apply gentle scaling (max 2x) to show something
      // This handles very quiet but real audio without amplifying pure noise
      normScale = Math.min(2.0, TARGET_AMPLITUDE / peakAmplitude)
    }
    // Below 0.001 (0.1%): leave normScale at 1.0 - this is essentially silence/noise

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
    // See DEVIATION_THRESHOLDS and MAX_GAIN_BY_LEVEL constants for detailed explanation
    let maxAllowedGain: number
    if (maxDeviation <= DEVIATION_THRESHOLDS.VERY_QUIET) {
      maxAllowedGain = MAX_GAIN_BY_LEVEL.VERY_QUIET
    } else if (maxDeviation <= DEVIATION_THRESHOLDS.QUIET) {
      maxAllowedGain = MAX_GAIN_BY_LEVEL.QUIET
    } else if (maxDeviation <= DEVIATION_THRESHOLDS.MEDIUM) {
      maxAllowedGain = MAX_GAIN_BY_LEVEL.MEDIUM
    } else {
      maxAllowedGain = MAX_GAIN_BY_LEVEL.LOUD
    }

    // Apply sqrt compression for perceptual scaling, then visibility boost
    // See GAIN_COMPRESSION constant for detailed rationale
    const compressedGain = Math.sqrt(baseGain) * GAIN_COMPRESSION.VISIBILITY_BOOST
    const targetGain = Math.max(Math.min(compressedGain, maxAllowedGain), 1.0)

    // Adaptive smoothing: fast attack (audio getting louder), slow release (getting quieter)
    // This ensures responsive onset when user starts speaking, but smooth decay during pauses
    const smoothingFactor =
      targetGain > currentGainRef.current ? GAIN_SMOOTHING.ATTACK : GAIN_SMOOTHING.RELEASE
    currentGainRef.current += (targetGain - currentGainRef.current) * smoothingFactor

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
