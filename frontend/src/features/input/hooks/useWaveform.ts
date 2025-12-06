import { useRef, useEffect, useCallback } from 'react'
import { useRafInterval } from '../hooks'

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
  const dataArrayRef = useRef<Nullable<Uint8Array>>(null)

  // Waveform data refs
  const lastWaveformRef = useRef<Uint8Array | null>(null)
  const peaksRef = useRef<Peaks | null>(null)
  const peaksComputationIdRef = useRef<number>(0)

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
  }, [])

  const drawWaveform = useCallback(() => {
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
  }, [])

  const cleanupWaveform = useCallback(() => {
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    analyserRef.current = null
    dataArrayRef.current = null
  }, [])

  // ─────────────────────────────────────────────────────────────────────────────
  // Peaks computation from audio blob
  // ─────────────────────────────────────────────────────────────────────────────

  const getDecodingAudioContext = useCallback(() => {
    if (!decodingAudioContextRef.current || decodingAudioContextRef.current.state === 'closed') {
      const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
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
  const computePeaksFromBlob = useCallback(async (blob: Blob) => {
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
  }, [getDecodingAudioContext, drawPeaks])

  /**
   * Reset all waveform state (call when discarding a recording)
   */
  const resetWaveform = useCallback(() => {
    invalidatePeaks()
    lastWaveformRef.current = null
    peaksRef.current = null
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

