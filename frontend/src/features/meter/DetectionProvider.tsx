import { sendLexicalText, sendProsodicAudio } from '@/features/input/apiService'
import React, { createContext, useEffect, useRef, useState } from 'react'
import type { DetectionStateType } from './meterConstants'
import {
  DetectionState,
  NEEDLE_RETURN_DURATION_MS,
  RESULT_HOLD_DURATION_MS,
} from './meterConstants'
import { useWhichInput } from './useWhichInput'

export type DetectionValues = {
  lexical: number
  prosodic: number
  lexicalReliable?: boolean
  prosodicReliable?: boolean
}

export type DetectionContextType = {
  // Current detection state
  state: DetectionStateType
  // Is currently loading (API call in flight)
  isLoading: boolean
  // Is cable animation active (stays true for minimum visible duration)
  cableAnimating: boolean
  // Current meter values (0-1)
  lexicalValue: number
  prosodicValue: number
  // Main needle value (average of lexical and prosodic)
  mainValue: number
  // Whether predictions are reliable (from real ML model vs fallback)
  isReliable: boolean
  // Trigger a new detection with the given values
  setDetectionResult: (values: Partial<DetectionValues>) => void
  // Set loading state (called when API request starts)
  setLoading: (loading: boolean) => void
  // Reset to idle state
  reset: () => void
  // DEV MODE: Trigger test detection by calling real endpoints (press 'h' key)
  triggerTestDetection: () => void
}

const defaultContext: DetectionContextType = {
  state: DetectionState.IDLE,
  isLoading: false,
  cableAnimating: false,
  lexicalValue: 0,
  prosodicValue: 0,
  mainValue: 0,
  isReliable: true,
  setDetectionResult: () => {},
  setLoading: () => {},
  reset: () => {},
  triggerTestDetection: () => {},
}

export const DetectionContext = createContext<DetectionContextType>(defaultContext)

type DetectionProviderProps = {
  children: React.ReactNode
}

// Test phrases for dev mode 'h' key detection (sarcastic examples)
const TEST_PHRASES = [
  'Oh great, another meeting that could have been an email.',
  'I just love waking up at 5am on a Monday.',
  'What a surprise, the printer is jammed again.',
  "Sure, I'd love to hear more about your cryptocurrency investments.",
  'Nothing says fun like doing taxes on a Saturday.',
  'Wow, traffic is so enjoyable today.',
  "I'm absolutely thrilled to be here.",
  'This is exactly what I wanted to do with my weekend.',
  'Oh wonderful, my code works on the first try. Said no one ever.',
  'Yes, I definitely wanted to spend my Friday night debugging.',
]

/**
 * Create a minimal valid WAV audio blob for testing prosodic endpoint.
 * Uses 16kHz sample rate to match Wav2Vec2 requirements.
 */
function createTestAudioBlob(): Blob {
  const sampleRate = 16000
  const duration = 0.1 // 100ms
  const frequency = 440
  const amplitude = 0.3

  const numSamples = Math.floor(sampleRate * duration)
  const bytesPerSample = 2
  const dataSize = numSamples * bytesPerSample
  const fileSize = 44 + dataSize - 8

  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  // RIFF header
  writeString(0, 'RIFF')
  view.setUint32(4, fileSize, true)
  writeString(8, 'WAVE')

  // fmt chunk
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * bytesPerSample, true)
  view.setUint16(32, bytesPerSample, true)
  view.setUint16(34, 16, true)

  // data chunk
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  // Generate 440Hz tone samples
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate
    const sample = Math.floor(Math.sin(2 * Math.PI * frequency * t) * amplitude * 32767)
    view.setInt16(44 + i * 2, sample, true)
  }

  return new Blob([new Uint8Array(buffer)], { type: 'audio/wav' })
}

// Minimum duration the cable animation stays visible (ms)
const CABLE_ANIMATION_MIN_DURATION_MS = 800

export function DetectionProvider({ children }: DetectionProviderProps) {
  const [state, setState] = useState<DetectionStateType>(DetectionState.IDLE)
  const [isLoading, setIsLoading] = useState(false)
  const [cableAnimating, setCableAnimating] = useState(false)
  const [lexicalValue, setLexicalValue] = useState(0)
  const [prosodicValue, setProsodicValue] = useState(0)
  const [isReliable, setIsReliable] = useState(true)

  // Get current input mode for 'h' key behavior
  const { value: inputMode } = useWhichInput()

  // Refs to track timers for cleanup
  const holdTimeoutRef = useRef<number | null>(null)
  const resetTimeoutRef = useRef<number | null>(null)
  const cableAnimationTimeoutRef = useRef<number | null>(null)
  const rafIdRef = useRef<number | null>(null)

  // Calculate main value as average
  const mainValue = (lexicalValue + prosodicValue) / 2

  // Cleanup function for detection cycle timers (does NOT clear cable animation)
  const clearTimers = () => {
    if (holdTimeoutRef.current !== null) {
      window.clearTimeout(holdTimeoutRef.current)
      holdTimeoutRef.current = null
    }
    if (resetTimeoutRef.current !== null) {
      window.clearTimeout(resetTimeoutRef.current)
      resetTimeoutRef.current = null
    }
    // Also cancel any pending requestAnimationFrame from setDetectionResult
    if (rafIdRef.current !== null) {
      window.cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
  }

  // Cleanup cable animation timer (used when starting new animation or unmounting)
  const clearCableAnimationTimer = () => {
    if (cableAnimationTimeoutRef.current !== null) {
      window.clearTimeout(cableAnimationTimeoutRef.current)
      cableAnimationTimeoutRef.current = null
    }
  }

  // Cleanup timers on unmount to prevent memory leaks and race conditions
  useEffect(() => {
    return () => {
      clearTimers()
      clearCableAnimationTimer()
    }
  }, [])

  // Track previous input mode to detect changes
  const prevInputModeRef = useRef(inputMode)

  // Reset detector when rotary switch position changes
  useEffect(() => {
    if (prevInputModeRef.current !== inputMode) {
      // Input mode changed - reset the detector to clear any in-progress detection
      clearTimers()
      clearCableAnimationTimer()
      setIsLoading(false)
      setCableAnimating(false)
      setLexicalValue(0)
      setProsodicValue(0)
      setIsReliable(true)
      setState(DetectionState.IDLE)
      prevInputModeRef.current = inputMode
    }
  }, [inputMode])

  // Set loading state
  const setLoading = (loading: boolean) => {
    setIsLoading(loading)
    if (loading) {
      // Cancel any pending result cycle if we start a new request
      clearTimers()
      setState(DetectionState.LOADING)

      // Reset values to 0 so the needle returns to baseline during loading
      // This ensures a clean visual transition when rapidly sending detections
      setLexicalValue(0)
      setProsodicValue(0)

      // Clear any existing cable animation timer before starting new one
      clearCableAnimationTimer()

      // Start cable animation immediately and keep it running for minimum duration
      setCableAnimating(true)
      cableAnimationTimeoutRef.current = window.setTimeout(() => {
        setCableAnimating(false)
        cableAnimationTimeoutRef.current = null
      }, CABLE_ANIMATION_MIN_DURATION_MS)
    }
  }

  // Handle detection result - receives values and manages the cycle
  const setDetectionResult = (values: Partial<DetectionValues>) => {
    // Clear any existing timers
    clearTimers()

    // First, stop the loading animation by clearing isLoading
    // This removes the CSS animation class from the needle
    setIsLoading(false)

    // Wait one frame before updating values to allow CSS transition to work
    // This is necessary because CSS transitions don't fire when an animation
    // is removed and the property changes in the same frame
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null
      // Update values - this will now trigger a CSS transition
      if (values.lexical !== undefined) {
        setLexicalValue(values.lexical)
      }
      if (values.prosodic !== undefined) {
        setProsodicValue(values.prosodic)
      }

      // Update reliability - unreliable if ANY prediction is unreliable
      const lexicalReliable = values.lexicalReliable ?? true
      const prosodicReliable = values.prosodicReliable ?? true
      setIsReliable(lexicalReliable && prosodicReliable)

      // Transition to holding result state
      setState(DetectionState.HOLDING_RESULT)

      // After hold duration, transition to resetting
      holdTimeoutRef.current = window.setTimeout(() => {
        setState(DetectionState.RESETTING)

        // Reset values to 0
        setLexicalValue(0)
        setProsodicValue(0)

        // After reset animation, return to idle
        resetTimeoutRef.current = window.setTimeout(() => {
          setState(DetectionState.IDLE)
        }, NEEDLE_RETURN_DURATION_MS)
      }, RESULT_HOLD_DURATION_MS)
    })
  }

  // Manual reset
  const reset = () => {
    clearTimers()
    clearCableAnimationTimer()
    setIsLoading(false)
    setCableAnimating(false)
    setLexicalValue(0)
    setProsodicValue(0)
    setIsReliable(true)
    setState(DetectionState.IDLE)
  }

  // DEV MODE ONLY: Trigger a test detection by calling real endpoints
  // Only available in development builds (gated by import.meta.env.DEV)
  // Behavior depends on current input mode:
  // - 'audio': calls both prosodic and lexical endpoints
  // - 'text': calls only lexical endpoint
  // - 'off': does nothing
  const triggerTestDetection = async () => {
    // Fail fast: entire function is dev-only
    if (!import.meta.env.DEV) return

    // Don't trigger if already in a detection cycle
    if (isLoading || state !== DetectionState.IDLE) {
      console.log('🔧 Dev mode: Detection already in progress, skipping')
      return
    }

    // Don't trigger in 'off' mode
    if (inputMode === 'off') {
      console.log('🔧 Dev mode: Input is off, skipping')
      return
    }

    // Pick a random test phrase
    const testPhrase = TEST_PHRASES[Math.floor(Math.random() * TEST_PHRASES.length)]
    console.log(`🔧 Dev mode: Testing in "${inputMode}" mode with phrase: "${testPhrase}"`)

    setLoading(true)

    try {
      if (inputMode === 'audio') {
        // Audio mode: call both prosodic and lexical endpoints
        const testAudio = createTestAudioBlob()
        const [prosodicResponse, lexicalResponse] = await Promise.all([
          sendProsodicAudio(testAudio),
          sendLexicalText(testPhrase),
        ])
        console.log(
          `🔧 Dev mode: Result - Lexical: ${(lexicalResponse.value * 100).toFixed(1)}% (reliable: ${lexicalResponse.reliable}), Prosodic: ${(prosodicResponse.value * 100).toFixed(1)}% (reliable: ${prosodicResponse.reliable})`
        )
        setDetectionResult({
          lexical: lexicalResponse.value,
          prosodic: prosodicResponse.value,
          lexicalReliable: lexicalResponse.reliable,
          prosodicReliable: prosodicResponse.reliable,
        })
      } else {
        // Text mode: call only lexical endpoint
        const response = await sendLexicalText(testPhrase)
        console.log(
          `🔧 Dev mode: Result - Lexical: ${(response.value * 100).toFixed(1)}% (reliable: ${response.reliable})`
        )
        setDetectionResult({
          lexical: response.value,
          prosodic: 0,
          lexicalReliable: response.reliable,
          prosodicReliable: true, // Not used in text mode
        })
      }
    } catch (error) {
      console.error('🔧 Dev mode: API call failed:', error)
      reset()
    }
  }

  // DEV MODE ONLY: Listen for 'h' key to trigger test detection
  // Only registered in development builds to avoid leaking dev functionality
  useEffect(() => {
    // Skip entirely in production builds
    if (!import.meta.env.DEV) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger on 'h' key, ignore if typing in an input
      if (e.key === 'h' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        triggerTestDetection()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    if (import.meta.env.DEV) console.log('🔧 Dev mode enabled: Press "h" to trigger test detection')

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputMode, isLoading, state])

  const contextValue: DetectionContextType = {
    state,
    isLoading,
    cableAnimating,
    lexicalValue,
    prosodicValue,
    mainValue,
    isReliable,
    setDetectionResult,
    setLoading,
    reset,
    triggerTestDetection,
  }

  return <DetectionContext.Provider value={contextValue}>{children}</DetectionContext.Provider>
}
