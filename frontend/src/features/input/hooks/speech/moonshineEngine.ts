/**
 * MoonshineJS Speech Recognition Engine
 *
 * Primary speech-to-text engine using MoonshineJS.
 * Runs entirely in-browser using WebAssembly.
 *
 * Pros:
 * - Works offline after initial model download
 * - Privacy-friendly (no data sent to servers)
 * - Consistent behavior across browsers
 *
 * Cons:
 * - Large model download (~400MB for base)
 * - Can be flaky on some devices
 * - Requires WebAssembly support
 */

import * as Moonshine from '@moonshine-ai/moonshine-js'
import { isDev } from '../../utils/env'
import type { SpeechEngine, SpeechEngineCallbacks } from './types'
import { INITIALIZATION_CANCELLED_ERROR } from './types'

const LOG_PREFIX = '[Moonshine]'

function log(...args: unknown[]) {
  if (isDev()) {
    console.log(LOG_PREFIX, ...args)
  }
}

function logError(...args: unknown[]) {
  if (isDev()) {
    console.error(LOG_PREFIX, ...args)
  }
}

// Track preload state
let preloadPromise: Promise<void> | null = null

// Track preload result for debugging/retry logic
export type PreloadStatus = 'idle' | 'loading' | 'success' | 'partial_failure' | 'failed'
let preloadStatus: PreloadStatus = 'idle'

/**
 * Get the current preload status.
 * - 'idle': preload hasn't started
 * - 'loading': preload is in progress
 * - 'success': all model files downloaded successfully
 * - 'partial_failure': some files failed to download (retry possible)
 * - 'failed': all files failed to download (retry possible)
 */
export function getPreloadStatus(): PreloadStatus {
  return preloadStatus
}

/**
 * Reset preload state to allow a fresh preload attempt.
 * Use this if you want to force a retry after a partial or complete failure.
 */
export function resetPreloadState(): void {
  preloadPromise = null
  preloadStatus = 'idle'
}

// Progress tracking
export type DownloadProgress = {
  bytesDownloaded: number
  totalBytes: number
  percent: number
  currentFile: string
  filesCompleted: number
  totalFiles: number
}

export type ProgressCallback = (progress: DownloadProgress) => void

let progressCallback: ProgressCallback | null = null

/**
 * Set a callback to receive download progress updates.
 * Call with null to remove the callback.
 */
export function setDownloadProgressCallback(callback: ProgressCallback | null): void {
  progressCallback = callback
}

/**
 * Get the model path to use for Moonshine.
 */
function getModelPath(): string {
  // In dev mode, check for model override
  if (isDev()) {
    const override = localStorage.getItem('moonshine_model_override')
    if (override) return override
  }
  // Use env variable or default to base model
  const envModel = import.meta.env.VITE_MOONSHINE_MODEL
  return typeof envModel === 'string' && envModel.trim() ? envModel.trim() : 'model/base'
}

/**
 * Fetch a file with progress tracking.
 * Returns the total bytes downloaded.
 */
async function fetchWithProgress(
  url: string,
  onProgress: (bytesReceived: number, totalBytes: number) => void
): Promise<number> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`)
  }

  const contentLength = response.headers.get('Content-Length')
  const totalBytes = contentLength ? parseInt(contentLength, 10) : 0

  // If no Content-Length or no body, fall back to simple fetch
  if (!response.body || !totalBytes) {
    const buffer = await response.arrayBuffer()
    onProgress(buffer.byteLength, buffer.byteLength)
    return buffer.byteLength
  }

  const reader = response.body.getReader()
  let bytesReceived = 0

  // Consume the stream for caching and progress tracking without storing chunks
  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    bytesReceived += value.length
    onProgress(bytesReceived, totalBytes)
  }

  return bytesReceived
}

// Moonshine CDN base URL
const MOONSHINE_CDN = 'https://download.moonshine.ai'

/**
 * Get the CDN URL for a model file.
 * The model path (e.g., 'model/base') maps to CDN structure.
 */
function getModelCdnUrl(modelPath: string, fileName: string): string {
  // modelPath is like 'model/base' or 'model/tiny'
  // CDN structure is https://download.moonshine.ai/model/{name}/quantized/{file}
  const modelName = modelPath.replace('model/', '')
  return `${MOONSHINE_CDN}/model/${modelName}/quantized/${fileName}`
}

/**
 * Preload the Moonshine model in the background by fetching model files.
 * This pre-caches the model so it loads faster when the user clicks record.
 * Progress updates are sent via the callback set with setDownloadProgressCallback.
 */
export async function preloadMoonshineModel(): Promise<void> {
  // Return existing preload promise if already started
  if (preloadPromise) {
    return preloadPromise
  }

  const modelPath = getModelPath()
  log('Preloading model in background:', modelPath)

  preloadStatus = 'loading'

  preloadPromise = (async () => {
    try {
      // MoonshineJS models are served from their CDN
      // The library loads: encoder_model.onnx and decoder_model_merged.onnx
      // These are the main model files (see moonshine-js/src/model.ts)
      const modelFileNames = ['encoder_model.onnx', 'decoder_model_merged.onnx']
      const modelFiles = modelFileNames.map(name => getModelCdnUrl(modelPath, name))

      log('Preload: Fetching model files...')

      // Track overall progress
      let totalBytesDownloaded = 0
      let estimatedTotalBytes = 400 * 1024 * 1024 // ~400MB for base model
      let filesCompleted = 0

      // Report initial progress
      if (progressCallback) {
        progressCallback({
          bytesDownloaded: 0,
          totalBytes: estimatedTotalBytes,
          percent: 0,
          currentFile: modelFiles[0],
          filesCompleted: 0,
          totalFiles: modelFiles.length,
        })
      }

      // Download files sequentially for accurate progress tracking
      let filesFailed = 0
      for (const file of modelFiles) {
        try {
          const fileName = file.split('/').pop() || file
          log(`Preload: Downloading ${fileName}...`)

          const fileBytes = await fetchWithProgress(file, (bytesReceived, totalBytes) => {
            if (progressCallback) {
              // Update estimated total based on first large file
              if (filesCompleted === 0 && totalBytes > 0 && file.includes('encoder')) {
                // encoder.onnx is typically the largest, ~60% of total
                estimatedTotalBytes = Math.round(totalBytes / 0.6)
              }

              progressCallback({
                bytesDownloaded: totalBytesDownloaded + bytesReceived,
                totalBytes: estimatedTotalBytes,
                percent: Math.min(
                  99,
                  Math.round(((totalBytesDownloaded + bytesReceived) / estimatedTotalBytes) * 100)
                ),
                currentFile: fileName,
                filesCompleted,
                totalFiles: modelFiles.length,
              })
            }
          })

          totalBytesDownloaded += fileBytes
          filesCompleted++
          log(`Preload: Cached ${fileName} (${Math.round(fileBytes / 1024 / 1024)}MB)`)
        } catch (error) {
          // Log the actual error for debugging - could be network, CORS, or CDN issues
          const errorMessage = error instanceof Error ? error.message : String(error)
          log(`Preload: Failed to cache ${file}: ${errorMessage}`)
          filesFailed++
          filesCompleted++
        }
      }

      // Handle failures - reset preloadPromise to allow retry
      if (filesFailed === modelFiles.length) {
        // All files failed - likely indicates a real problem
        logError(
          `Preload: All ${filesFailed} model files failed to download. ` +
            'This may indicate network issues, CORS problems, or CDN unavailability.'
        )
        preloadStatus = 'failed'
        preloadPromise = null // Allow retry
      } else if (filesFailed > 0) {
        // Partial failure - some files cached but not all
        log(`Preload: ${filesFailed}/${modelFiles.length} files failed to cache`)
        preloadStatus = 'partial_failure'
        preloadPromise = null // Allow retry
      } else {
        // All files succeeded
        preloadStatus = 'success'
      }

      // Report completion
      if (progressCallback) {
        progressCallback({
          bytesDownloaded: totalBytesDownloaded,
          totalBytes: totalBytesDownloaded,
          percent: 100,
          currentFile: '',
          filesCompleted: modelFiles.length,
          totalFiles: modelFiles.length,
        })
      }

      if (filesFailed === 0) {
        log(
          `Preload: Model files cached successfully (${Math.round(totalBytesDownloaded / 1024 / 1024)}MB total)`
        )
      }
    } catch (error) {
      logError('Preload error:', error)
      preloadStatus = 'failed'
      preloadPromise = null
      throw error
    }
  })()

  return preloadPromise
}

// Max time to wait for first transcript before transitioning to 'listening' anyway.
// This is a fallback for when there's silence during initialization - VAD needs speech
// to confirm it's ready. 10 seconds provides headroom for slower devices while still
// preventing users from being stuck in loading state indefinitely.
const MAX_VAD_WAIT_MS = 10000

// Max time to wait for the entire model loading process (download + initialization).
// If this timeout fires, we show an error and allow the user to retry.
// 45 seconds is generous for slow connections but prevents indefinite waiting.
const MAX_MODEL_LOAD_MS = 45000

export function createMoonshineEngine(callbacks: SpeechEngineCallbacks): SpeechEngine {
  let transcriber: Moonshine.MicrophoneTranscriber | null = null
  let listening = false
  let vadReady = false // Track if VAD has detected speech (system is fully ready)
  let wasStopped = false // Track if stop() was called during start()
  let vadTimeoutId: ReturnType<typeof setTimeout> | null = null // Timeout for VAD confirmation
  let modelLoadTimeoutId: ReturnType<typeof setTimeout> | null = null // Timeout for entire model load
  let readyResolve: (() => void) | null = null // Resolve function for ready promise
  let readyResolved = false // Flag to prevent double-resolution of ready promise

  /**
   * Clear all loading-related timeouts.
   */
  function clearAllTimeouts(): void {
    if (vadTimeoutId) {
      clearTimeout(vadTimeoutId)
      vadTimeoutId = null
    }
    if (modelLoadTimeoutId) {
      clearTimeout(modelLoadTimeoutId)
      modelLoadTimeoutId = null
    }
  }

  /**
   * Safely resolve the ready promise exactly once.
   * Prevents race conditions if multiple callbacks fire rapidly.
   */
  function resolveReady(): void {
    if (readyResolved) return
    readyResolved = true
    if (readyResolve) {
      readyResolve()
      readyResolve = null
    }
  }

  return {
    name: 'MoonshineJS',

    isSupported(): boolean {
      // MoonshineJS requires WebAssembly
      return typeof WebAssembly !== 'undefined'
    },

    async start(): Promise<void> {
      if (transcriber) {
        log('Already running, ignoring start()')
        return
      }

      // Reset flags at start of each attempt
      wasStopped = false
      readyResolved = false
      readyResolve = null // Clear stale resolve function to prevent race conditions

      const modelPath = getModelPath()
      log('Starting with model:', modelPath)

      transcriber = new Moonshine.MicrophoneTranscriber(
        modelPath,
        {
          onTranscriptionCommitted: (text: string) => {
            log('Final transcript:', text)
            // First transcript means system is ready - switch to 'listening' status
            if (!vadReady) {
              vadReady = true
              listening = true
              // Clear all timeouts - we're successfully listening
              clearAllTimeouts()
              log('System ready - first transcript received')
              callbacks.onStatusChange('listening')
              // Resolve the ready promise so startRecording can proceed
              resolveReady()
            }
            if (listening && text.trim()) {
              callbacks.onTranscriptUpdate({ interim: '', final: text })
            }
          },
          onTranscriptionUpdated: (text: string) => {
            log('Interim transcript:', text)
            // First transcript means system is ready - switch to 'listening' status
            // This may fire before onModelLoadComplete if model was cached
            if (!vadReady) {
              vadReady = true
              listening = true // Ensure listening is set
              // Clear all timeouts - we're successfully listening
              clearAllTimeouts()
              log('System ready - first transcript received')
              callbacks.onStatusChange('listening')
              // Resolve the ready promise so startRecording can proceed
              resolveReady()
            }
            if (listening) {
              callbacks.onTranscriptUpdate({ interim: text, final: '' })
            }
          },
          onModelLoadStart: () => {
            log('Model loading...')
            callbacks.onStatusChange('loading')

            // Start hard timeout for entire model loading process
            // This catches cases where model download hangs or fails silently
            if (modelLoadTimeoutId) clearTimeout(modelLoadTimeoutId)
            modelLoadTimeoutId = setTimeout(() => {
              // Only fire if we're still in loading state (not yet listening)
              if (!vadReady && !listening && transcriber) {
                logError(
                  `Model loading timeout (${MAX_MODEL_LOAD_MS / 1000}s) - ` +
                    'model may have failed to download. Check network connection.'
                )
                callbacks.onError(
                  'Speech model is taking too long to load. Please check your connection and try again.'
                )
                callbacks.onStatusChange('error')
              }
            }, MAX_MODEL_LOAD_MS)
          },
          onModelLoadComplete: () => {
            log('Model loaded, waiting for VAD...')
            // Model loaded successfully - clear the hard timeout
            if (modelLoadTimeoutId) {
              clearTimeout(modelLoadTimeoutId)
              modelLoadTimeoutId = null
            }

            // Model is loaded but VAD still needs to initialize
            // Keep 'loading' status until we get the first transcript
            // We track listening state internally (see runtime check after transcriber creation)
            listening = true
            // Don't set 'listening' status here - wait for first transcript
            // This keeps the loading indicator visible during VAD initialization

            // Fallback: if no transcript received within timeout, transition anyway
            // This prevents getting stuck in loading state if there's silence
            if (vadTimeoutId) clearTimeout(vadTimeoutId)
            vadTimeoutId = setTimeout(() => {
              if (!vadReady && listening && transcriber) {
                // Log a warning - system may not be fully ready but we're proceeding
                // to avoid leaving users stuck in loading state. This typically fires
                // when there's silence during initialization (VAD needs speech to confirm ready).
                logError(
                  'VAD timeout reached - transitioning to listening without VAD confirmation. ' +
                    'If transcription issues occur, try speaking immediately after clicking record.'
                )
                vadReady = true
                callbacks.onStatusChange('listening')
                // Resolve the ready promise so startRecording can proceed
                resolveReady()
              }
            }, MAX_VAD_WAIT_MS)
          },
          onError: (error: Error) => {
            logError('Runtime error:', error)
            callbacks.onError(`Transcription error: ${error.message}`)
            callbacks.onStatusChange('error')
          },
        },
        false // Disable VAD for continuous streaming
      )

      // Runtime assertion: isListening() doesn't exist in @moonshine-ai/moonshine-js v0.1.29
      // If it becomes available in a future version, log it so we know we can use it
      // instead of tracking listening state manually
      if ('isListening' in transcriber) {
        log(
          'Note: isListening() method is now available in MoonshineJS. ' +
            'Consider using it instead of manual listening state tracking.'
        )
      }

      // Create a promise that resolves when the system is ready (vadReady = true)
      const readyPromise = new Promise<void>(resolve => {
        // If already ready (shouldn't happen, but just in case)
        if (vadReady) {
          resolve()
          return
        }
        // Store resolve function so callbacks can resolve it
        readyResolve = resolve
      })

      await transcriber.start()

      // Check if stop() was called while awaiting transcriber.start()
      // If so, don't access transcriber properties and throw a specific error
      // to prevent fallback to Web Speech API
      if (wasStopped || !transcriber) {
        log('Start was interrupted by stop() call')
        // Clean up the ready promise - resolve it to avoid hanging awaits
        resolveReady()
        throw new Error(INITIALIZATION_CANCELLED_ERROR)
      }

      log('Transcriber started, waiting for system to be ready...')
      // Set listening state after successful start
      // Note: onModelLoadComplete callback may not fire when model is already cached,
      // so we must also set listening here to ensure transcripts are processed
      if (!listening) {
        listening = true
        callbacks.onStatusChange('loading')
      }

      // Set fallback VAD timeout if not already set by onModelLoadComplete
      // This handles the case where model was cached and onModelLoadComplete didn't fire
      if (!vadTimeoutId && !vadReady) {
        log('Setting fallback timeout for cached model scenario')
        vadTimeoutId = setTimeout(() => {
          if (!vadReady && listening && transcriber) {
            logError(
              'VAD timeout reached (cached model) - transitioning to listening without VAD confirmation. ' +
                'If transcription issues occur, try speaking immediately after clicking record.'
            )
            vadReady = true
            callbacks.onStatusChange('listening')
            resolveReady()
          }
        }, MAX_VAD_WAIT_MS)
      }

      // Wait for the system to be fully ready before returning
      // This ensures MediaRecorder doesn't start until speech recognition is ready
      await readyPromise
      log('System ready, start() complete')
    },

    stop(): void {
      log('Stopping...')
      // Mark that stop was called - this prevents accessing transcriber
      // if stop() is called while start() is awaiting transcriber.start()
      wasStopped = true
      // Clear any pending timeouts (both VAD and model load)
      clearAllTimeouts()
      // Resolve the ready promise if pending (so start() doesn't hang)
      resolveReady()
      if (transcriber) {
        try {
          transcriber.stop()
        } catch {
          // May already be stopped
        }
        transcriber = null
      }
      listening = false
      vadReady = false
      callbacks.onStatusChange('idle')
    },

    isListening(): boolean {
      // We track listening state internally because transcriber.isListening()
      // doesn't exist in @moonshine-ai/moonshine-js v0.1.29.
      // A runtime check in start() will log if this method becomes available.
      // DO NOT call transcriber.isListening() - it will throw at runtime.
      return listening && transcriber !== null
    },
  }
}
