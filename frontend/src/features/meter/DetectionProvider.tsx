import React, { createContext, useEffect, useRef, useState } from 'react'
import {
  DetectionState,
  RESULT_HOLD_DURATION_MS,
  NEEDLE_RETURN_DURATION_MS,
} from './meterConstants'
import type { DetectionStateType } from './meterConstants'
import { sendLexicalText, sendProsodicAudio } from '../input/apiService'
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

// Test phrases for the 'h' key shortcut
const TEST_PHRASES = [
  'Oh great, another meeting that could have been an email.',
  'I just love waking up at 5am on a Monday.',
  'What a surprise, the printer is jammed again.',
  "Sure, I'd love to hear more about your cryptocurrency investments.",
  'Nothing says fun like doing taxes on a Saturday.',
  'Wow, traffic is so enjoyable today.',
  "I'm absolutely thrilled to be here.",
  'This is exactly what I wanted to do with my weekend.',
]

/**
 * Create a minimal valid WAV audio blob for testing prosodic endpoint.
 * This creates a tiny silent audio file.
 */
function createTestAudioBlob(): Blob {
  // Minimal WAV header for a silent mono 8kHz 8-bit audio (44 bytes header + 1 byte data)
  const header = new Uint8Array([
    0x52,
    0x49,
    0x46,
    0x46, // "RIFF"
    0x25,
    0x00,
    0x00,
    0x00, // File size - 8 (37 bytes)
    0x57,
    0x41,
    0x56,
    0x45, // "WAVE"
    0x66,
    0x6d,
    0x74,
    0x20, // "fmt "
    0x10,
    0x00,
    0x00,
    0x00, // Subchunk1 size (16)
    0x01,
    0x00, // Audio format (1 = PCM)
    0x01,
    0x00, // Num channels (1 = mono)
    0x40,
    0x1f,
    0x00,
    0x00, // Sample rate (8000)
    0x40,
    0x1f,
    0x00,
    0x00, // Byte rate (8000)
    0x01,
    0x00, // Block align (1)
    0x08,
    0x00, // Bits per sample (8)
    0x64,
    0x61,
    0x74,
    0x61, // "data"
    0x01,
    0x00,
    0x00,
    0x00, // Subchunk2 size (1 byte of audio)
    0x80, // One silent sample (128 = silence for 8-bit)
  ])
  return new Blob([header], { type: 'audio/wav' })
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

  // Set loading state
  const setLoading = (loading: boolean) => {
    setIsLoading(loading)
    if (loading) {
      // Cancel any pending result cycle if we start a new request
      clearTimers()
      setState(DetectionState.LOADING)

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
    requestAnimationFrame(() => {
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
