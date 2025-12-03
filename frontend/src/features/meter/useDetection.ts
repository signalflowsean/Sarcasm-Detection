import { useContext } from 'react';
import { DetectionContext } from './DetectionProvider';
import type { DetectionContextType } from './DetectionProvider';

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
 * - setDetectionResult: Set the detection values after API responds
 * - setLoading: Set loading state when API call starts
 * - reset: Reset all values to baseline
 */
export function useDetection(): DetectionContextType {
  const context = useContext(DetectionContext);
  
  if (!context) {
    throw new Error('useDetection must be used within a DetectionProvider');
  }
  
  return context;
}

