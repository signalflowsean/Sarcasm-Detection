import { useContext } from 'react'
import type { DetectionContextType } from '../context/DetectionProvider'
import { DetectionContext } from '../context/DetectionProvider'

/**
 * Hook to access detection state and methods
 *
 * Provides:
 * - state: Current detection cycle state (IDLE, LOADING, HOLDING_RESULT, RESETTING)
 * - isLoading: Whether an API call is in flight
 * - cableAnimating: Whether cable animation is active (stays true for minimum visible duration)
 * - lexicalValue: Current lexical meter value (0-1)
 * - prosodicValue: Current prosodic meter value (0-1)
 * - mainValue: Average of lexical and prosodic values
 * - isReliable: Whether predictions came from real ML models (false = fallback/unavailable)
 * - setDetectionResult: Set the detection values after API responds
 * - setLoading: Set loading state when API call starts
 * - reset: Reset all values to baseline
 */
export function useDetection(): DetectionContextType {
  const context = useContext(DetectionContext)

  if (!context) {
    throw new Error('useDetection must be used within a DetectionProvider')
  }

  return context
}
