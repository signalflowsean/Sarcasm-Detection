/**
 * App-level Moonshine model preloader.
 *
 * This hook should be used at the App level to start preloading
 * the Moonshine model as soon as the page loads (for browsers that need it).
 *
 * This improves UX by downloading the model in the background while
 * the user is still looking at the landing page or text input mode.
 */

import { useEffect, useState } from 'react'
import { isDev } from '../utils/env'
import {
  preloadMoonshineModel,
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

// Check if Moonshine is needed (do this once at module load)
const needsMoonshine = typeof window !== 'undefined' && !isWebSpeechSupported()

// Start preload immediately at module load (not in React lifecycle)
// This ensures download starts ASAP, even before React mounts
if (needsMoonshine && !preloadStarted && !preloadComplete) {
  log('Module init: Web Speech API not supported - starting preload immediately')
  preloadStarted = true

  preloadMoonshineModel()
    .then(() => {
      log('Preload complete!')
      preloadComplete = true
    })
    .catch(err => {
      log('Preload failed:', err)
      preloadError = true
      preloadStarted = false // Allow retry
    })
}

export type PreloadState = {
  /** Whether preload is currently in progress */
  isLoading: boolean
  /** Whether preload has completed */
  isComplete: boolean
  /** Download progress (null if not downloading or using Web Speech API) */
  progress: DownloadProgress | null
  /** Whether Moonshine is needed (Web Speech API not available) */
  needsMoonshine: boolean
}

/**
 * Hook to subscribe to Moonshine preload state.
 * The actual preload starts at module load, not in React lifecycle.
 */
export function useMoonshinePreload(): PreloadState {
  // Initialize with current module-level state
  const [isLoading, setIsLoading] = useState(preloadStarted && !preloadComplete && !preloadError)
  const [isComplete, setIsComplete] = useState(preloadComplete)
  const [progress, setProgress] = useState<DownloadProgress | null>(null)

  useEffect(() => {
    // If Web Speech API is available, no need to preload Moonshine
    if (!needsMoonshine) {
      return
    }

    // If already complete, update state
    if (preloadComplete) {
      setIsComplete(true)
      setIsLoading(false)
      return
    }

    // If preload is in progress, track it
    if (preloadStarted && !preloadComplete) {
      setIsLoading(true)

      // Set up progress callback
      setDownloadProgressCallback(p => {
        log('Progress update:', p.percent + '%')
        setProgress(p)

        // Check if complete
        if (preloadComplete) {
          setIsComplete(true)
          setIsLoading(false)
        }
      })

      // Poll for completion (in case callback doesn't fire for final state)
      const checkComplete = setInterval(() => {
        if (preloadComplete) {
          setIsComplete(true)
          setIsLoading(false)
          clearInterval(checkComplete)
        }
        if (preloadError) {
          setIsLoading(false)
          clearInterval(checkComplete)
        }
      }, 100)

      return () => {
        clearInterval(checkComplete)
      }
    }
  }, [])

  return {
    isLoading,
    isComplete,
    progress,
    needsMoonshine,
  }
}
