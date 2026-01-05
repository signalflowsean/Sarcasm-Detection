/**
 * App-level Moonshine model preloader.
 *
 * This hook should be used at the App level to start preloading
 * the Moonshine model as soon as the page loads (for browsers that need it).
 *
 * This improves UX by downloading the model in the background while
 * the user is still looking at the landing page or text input mode.
 */

import { useCallback, useEffect, useState } from 'react'
import { isDev } from '../utils/env'
import {
  preloadMoonshineModel,
  resetPreloadState,
  setDownloadProgressCallback,
  type DownloadProgress,
} from './speech/moonshineEngine'
import { isWebSpeechSupported } from './speech/webSpeechEngine'

const LOG_PREFIX = '[MoonshinePreload]'

function log(...args: unknown[]) {
  if (isDev()) {
    console.log(LOG_PREFIX, ...args)
  }
}

// Module-level state to track preload across component remounts
let preloadStarted = false
let preloadComplete = false
let preloadError = false

// Listeners for state changes (to notify React components)
type StateChangeListener = () => void
const stateChangeListeners = new Set<StateChangeListener>()

function notifyStateChange() {
  stateChangeListeners.forEach(listener => listener())
}

// Check if Moonshine is needed (do this once at module load)
const needsMoonshine = typeof window !== 'undefined' && !isWebSpeechSupported()

// Check if we're in a test environment (Vitest sets MODE to 'test')
const isTestEnvironment = typeof import.meta.env !== 'undefined' && import.meta.env.MODE === 'test'

/**
 * Start preload (can be called at module init or as a retry)
 */
function startPreload(): void {
  if (preloadStarted || preloadComplete) return

  log('Starting preload...')
  preloadStarted = true
  preloadError = false
  notifyStateChange()

  preloadMoonshineModel()
    .then(() => {
      log('Preload complete!')
      preloadComplete = true
      preloadStarted = false
      notifyStateChange()
    })
    .catch(err => {
      log('Preload failed:', err)
      preloadError = true
      preloadStarted = false // Allow retry
      notifyStateChange()
    })
}

// Start preload immediately at module load (not in React lifecycle)
// This ensures download starts ASAP, even before React mounts
// Skip in test environments to avoid side effects and network requests during tests
if (needsMoonshine && !preloadStarted && !preloadComplete && !isTestEnvironment) {
  log('Module init: Web Speech API not supported - starting preload immediately')
  startPreload()
}

export type PreloadState = {
  /** Whether preload is currently in progress */
  isLoading: boolean
  /** Whether preload has completed successfully */
  isComplete: boolean
  /** Whether preload failed (can retry) */
  hasError: boolean
  /** Download progress (null if not downloading or using Web Speech API) */
  progress: DownloadProgress | null
  /** Whether Moonshine is needed (Web Speech API not available) */
  needsMoonshine: boolean
  /** Retry preload after failure */
  retry: () => void
}

/**
 * Hook to subscribe to Moonshine preload state.
 * The actual preload starts at module load, not in React lifecycle.
 */
export function useMoonshinePreload(): PreloadState {
  // Initialize with current module-level state
  const [isLoading, setIsLoading] = useState(preloadStarted && !preloadComplete && !preloadError)
  const [isComplete, setIsComplete] = useState(preloadComplete)
  const [hasError, setHasError] = useState(preloadError)
  const [progress, setProgress] = useState<DownloadProgress | null>(null)

  // Sync React state with module-level state
  const syncState = useCallback(() => {
    setIsLoading(preloadStarted && !preloadComplete && !preloadError)
    setIsComplete(preloadComplete)
    setHasError(preloadError)
  }, [])

  // Retry function to restart preload after failure
  const retry = useCallback(() => {
    if (!hasError) return
    log('Retrying preload...')
    // Reset module-level state
    preloadError = false
    preloadComplete = false
    // Reset the moonshine engine's internal preload state
    resetPreloadState()
    // Clear progress
    setProgress(null)
    // Start fresh preload
    startPreload()
  }, [hasError])

  useEffect(() => {
    // If Web Speech API is available, no need to preload Moonshine
    if (!needsMoonshine) {
      return
    }

    // Subscribe to state changes
    stateChangeListeners.add(syncState)

    // Sync initial state
    syncState()

    // If already complete, we're done
    if (preloadComplete) {
      return () => {
        stateChangeListeners.delete(syncState)
        setDownloadProgressCallback(null)
      }
    }

    // Set up progress callback
    setDownloadProgressCallback(p => {
      log('Progress update:', p.percent + '%')
      setProgress(p)
    })

    return () => {
      stateChangeListeners.delete(syncState)
      setDownloadProgressCallback(null)
    }
  }, [syncState])

  return {
    isLoading,
    isComplete,
    hasError,
    progress,
    needsMoonshine,
    retry,
  }
}
