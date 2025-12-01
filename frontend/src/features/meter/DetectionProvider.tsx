import React, { createContext, useCallback, useEffect, useRef, useState } from 'react';
import {
  DetectionState,
  RESULT_HOLD_DURATION_MS,
  NEEDLE_RETURN_DURATION_MS,
  MOCK_RESPONSE_DELAY_MS,
} from './meterConstants';
import type { DetectionStateType } from './meterConstants';
import { generateMockScore } from '../input/apiService';

export type DetectionValues = {
  lexical: number;
  prosodic: number;
};

export type DetectionContextType = {
  // Current detection state
  state: DetectionStateType;
  // Is currently loading (API call in flight)
  isLoading: boolean;
  // Current meter values (0-1)
  lexicalValue: number;
  prosodicValue: number;
  // Main needle value (average of lexical and prosodic)
  mainValue: number;
  // Trigger a new detection with the given values
  setDetectionResult: (values: Partial<DetectionValues>) => void;
  // Set loading state (called when API request starts)
  setLoading: (loading: boolean) => void;
  // Reset to idle state
  reset: () => void;
  // DEV MODE: Trigger mock detection with random values (press 'h' key)
  triggerMockDetection: () => void;
};

const defaultContext: DetectionContextType = {
  state: DetectionState.IDLE,
  isLoading: false,
  lexicalValue: 0,
  prosodicValue: 0,
  mainValue: 0,
  setDetectionResult: () => {},
  setLoading: () => {},
  reset: () => {},
  triggerMockDetection: () => {},
};

export const DetectionContext = createContext<DetectionContextType>(defaultContext);

type DetectionProviderProps = {
  children: React.ReactNode;
};

export function DetectionProvider({ children }: DetectionProviderProps) {
  const [state, setState] = useState<DetectionStateType>(DetectionState.IDLE);
  const [isLoading, setIsLoading] = useState(false);
  const [lexicalValue, setLexicalValue] = useState(0);
  const [prosodicValue, setProsodicValue] = useState(0);

  // Refs to track timers for cleanup
  const holdTimeoutRef = useRef<number | null>(null);
  const resetTimeoutRef = useRef<number | null>(null);

  // Calculate main value as average
  const mainValue = (lexicalValue + prosodicValue) / 2;

  // Cleanup function for timers
  const clearTimers = useCallback(() => {
    if (holdTimeoutRef.current !== null) {
      window.clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    if (resetTimeoutRef.current !== null) {
      window.clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }
  }, []);

  // Cleanup timers on unmount to prevent memory leaks and race conditions
  useEffect(() => {
    return clearTimers;
  }, [clearTimers]);

  // Set loading state
  const setLoading = useCallback((loading: boolean) => {
    setIsLoading(loading);
    if (loading) {
      // Cancel any pending result cycle if we start a new request
      clearTimers();
      setState(DetectionState.LOADING);
    }
  }, [clearTimers]);

  // Handle detection result - receives values and manages the cycle
  const setDetectionResult = useCallback((values: Partial<DetectionValues>) => {
    // Clear any existing timers
    clearTimers();

    // Update values
    if (values.lexical !== undefined) {
      setLexicalValue(values.lexical);
    }
    if (values.prosodic !== undefined) {
      setProsodicValue(values.prosodic);
    }

    // Transition to holding result state
    setIsLoading(false);
    setState(DetectionState.HOLDING_RESULT);

    // After hold duration, transition to resetting
    holdTimeoutRef.current = window.setTimeout(() => {
      setState(DetectionState.RESETTING);
      
      // Reset values to 0
      setLexicalValue(0);
      setProsodicValue(0);

      // After reset animation, return to idle
      resetTimeoutRef.current = window.setTimeout(() => {
        setState(DetectionState.IDLE);
      }, NEEDLE_RETURN_DURATION_MS);
    }, RESULT_HOLD_DURATION_MS);
  }, [clearTimers]);

  // Manual reset
  const reset = useCallback(() => {
    clearTimers();
    setIsLoading(false);
    setLexicalValue(0);
    setProsodicValue(0);
    setState(DetectionState.IDLE);
  }, [clearTimers]);

  // DEV MODE: Trigger a mock detection with random values
  const triggerMockDetection = useCallback(() => {
    // Don't trigger if already in a detection cycle
    if (isLoading || state !== DetectionState.IDLE) {
      console.log('🔧 Dev mode: Detection already in progress, skipping');
      return;
    }

    console.log('🔧 Dev mode: Triggering mock detection...');
    setLoading(true);

    // Simulate API delay, then set random results
    setTimeout(() => {
      const mockLexical = generateMockScore();
      const mockProsodic = generateMockScore();
      console.log(`🔧 Dev mode: Mock results - Lexical: ${(mockLexical * 100).toFixed(1)}%, Prosodic: ${(mockProsodic * 100).toFixed(1)}%`);
      setDetectionResult({ lexical: mockLexical, prosodic: mockProsodic });
    }, MOCK_RESPONSE_DELAY_MS);
  }, [isLoading, state, setLoading, setDetectionResult]);

  // DEV MODE: Listen for 'h' key to trigger mock detection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger on 'h' key, ignore if typing in an input
      if (e.key === 'h' && 
          !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        triggerMockDetection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    console.log('🔧 Dev mode enabled: Press "h" to trigger mock detection');

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [triggerMockDetection]);

  const contextValue: DetectionContextType = {
    state,
    isLoading,
    lexicalValue,
    prosodicValue,
    mainValue,
    setDetectionResult,
    setLoading,
    reset,
    triggerMockDetection,
  };

  return (
    <DetectionContext.Provider value={contextValue}>
      {children}
    </DetectionContext.Provider>
  );
}

