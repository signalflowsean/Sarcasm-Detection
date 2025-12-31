/**
 * API service for sarcasm detection endpoints.
 * Communicates with the Flask backend for lexical and prosodic analysis.
 */

// In Docker: empty string makes URLs relative (nginx proxies /api/* to backend)
// In development: falls back to direct backend connection
const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'

// ============================================================================
// Configuration Constants
// ============================================================================

/** Maximum text length in characters (matches backend MAX_TEXT_LENGTH) */
const MAX_TEXT_LENGTH = 10000

/** Maximum audio file size in MB (matches backend MAX_AUDIO_SIZE_MB) */
const MAX_AUDIO_SIZE_MB = 10

/** Request timeout in milliseconds (matches nginx proxy_read_timeout) */
const REQUEST_TIMEOUT_MS = 60000

export type ProsodicResponse = {
  id: string
  value: number // 0.0–1.0 inclusive
  reliable: boolean // true if from real ML model, false if fallback
}

export type LexicalResponse = {
  id: string
  value: number // 0.0–1.0 inclusive
  reliable: boolean // true if from real ML model, false if fallback
}

/**
 * Error response structure from the API.
 * All error responses follow this format.
 */
interface ErrorResponse {
  error: string
}

/**
 * Type guard to check if data is an ErrorResponse.
 * @param data - Unknown data to check
 * @returns True if data is an ErrorResponse
 */
function isErrorResponse(data: unknown): data is ErrorResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'error' in data &&
    typeof (data as ErrorResponse).error === 'string'
  )
}

/**
 * Type guard to check if data is a ProsodicResponse.
 * @param data - Unknown data to check
 * @returns True if data is a ProsodicResponse
 */
function isProsodicResponse(data: unknown): data is ProsodicResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'value' in data &&
    'reliable' in data &&
    typeof (data as ProsodicResponse).id === 'string' &&
    typeof (data as ProsodicResponse).value === 'number' &&
    typeof (data as ProsodicResponse).reliable === 'boolean'
  )
}

/**
 * Type guard to check if data is a LexicalResponse.
 * @param data - Unknown data to check
 * @returns True if data is a LexicalResponse
 */
function isLexicalResponse(data: unknown): data is LexicalResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'value' in data &&
    'reliable' in data &&
    typeof (data as LexicalResponse).id === 'string' &&
    typeof (data as LexicalResponse).value === 'number' &&
    typeof (data as LexicalResponse).reliable === 'boolean'
  )
}

/**
 * ID used for fallback lexical response when no text is available.
 * Used when sending audio-only requests in prosodic mode.
 */
export const NO_TEXT_RESPONSE_ID = 'no-text'

// Map MIME types to file extensions for upload filename
const MIME_TO_EXTENSION: Record<string, string> = {
  'audio/webm': '.webm',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/wave': '.wav',
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/ogg': '.ogg',
  'audio/flac': '.flac',
  'audio/mp4': '.m4a',
  'audio/aac': '.aac',
}

/**
 * Get file extension from blob MIME type.
 * Defaults to .webm for unknown types (most common browser recording format).
 */
function getExtensionFromBlob(blob: Blob): string {
  return MIME_TO_EXTENSION[blob.type] ?? '.webm'
}

// ============================================================================
// Request ID Generation
// ============================================================================

/**
 * Generate a unique request ID for tracking requests across frontend and backend.
 * Uses crypto.randomUUID() for cryptographically secure random IDs.
 * @returns A unique request ID string
 */
function generateRequestId(): string {
  return crypto.randomUUID()
}

// ============================================================================
// Timeout Handling
// ============================================================================

/**
 * Result of merging multiple AbortSignals.
 * Contains the merged signal and an optional cleanup function to remove event listeners.
 */
interface MergedAbortSignal {
  signal: AbortSignal
  cleanup?: () => void
}

/**
 * Merge multiple AbortSignals into a single signal that aborts when any signal aborts.
 * Falls back to manual event listener approach for browsers that don't support AbortSignal.any().
 *
 * @param signals - Array of AbortSignals to merge
 * @returns An object containing the merged AbortSignal and an optional cleanup function
 */
function mergeAbortSignals(signals: AbortSignal[]): MergedAbortSignal {
  // Use native AbortSignal.any() if available (Chrome 120+, Firefox 120+, Safari 17+)
  if (typeof AbortSignal.any === 'function') {
    return { signal: AbortSignal.any(signals) }
  }

  // Fallback for older browsers: create a new controller and listen to all signals
  const controller = new AbortController()

  // Check if any signal is already aborted
  if (signals.some(signal => signal.aborted)) {
    controller.abort()
    return { signal: controller.signal }
  }

  // Listen for abort events on all signals
  const abortHandler = () => controller.abort()
  signals.forEach(signal => {
    signal.addEventListener('abort', abortHandler)
  })

  // Clean up listeners when the controller's signal aborts
  // This prevents memory leaks by removing listeners once they're no longer needed
  const cleanup = () => {
    signals.forEach(signal => {
      signal.removeEventListener('abort', abortHandler)
    })
  }
  controller.signal.addEventListener('abort', cleanup, { once: true })

  return { signal: controller.signal, cleanup }
}

/**
 * Fetch wrapper with timeout support using AbortController.
 * Prevents hanging requests by aborting after the specified timeout.
 * Merges timeout signal with any existing signal in options to preserve both timeout and external abort capabilities.
 *
 * @param url - URL to fetch
 * @param options - Fetch options (may include an existing signal)
 * @param timeoutMs - Timeout in milliseconds (default: 60 seconds)
 * @returns Promise that resolves to the Response
 * @throws Error with 'Request timed out' message if timeout is reached
 * @throws Original error for other fetch failures
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  // Track cleanup function for merged signals to prevent memory leaks
  let signalCleanup: (() => void) | undefined

  try {
    // Merge timeout signal with any existing signal from options
    // This preserves both timeout and external abort capabilities
    const merged = options.signal
      ? mergeAbortSignals([options.signal, controller.signal])
      : { signal: controller.signal }

    signalCleanup = merged.cleanup
    const signal = merged.signal

    const response = await fetch(url, { ...options, signal })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      // Check if the timeout signal was the one that aborted
      // If controller.signal.aborted is true, it was a timeout
      // Otherwise, it was a user-initiated cancellation via options.signal
      if (controller.signal.aborted) {
        throw new Error('Request timed out - server took too long to respond')
      }
      // User-initiated cancellation - preserve the original error
      throw error
    }
    throw error
  } finally {
    // Always clean up event listeners to prevent memory leaks
    // This ensures listeners are removed even when the request completes successfully
    signalCleanup?.()
  }
}

// ============================================================================
// Input Validation
// ============================================================================

/**
 * Validate text input before sending to API.
 * Provides immediate feedback and prevents unnecessary API calls.
 *
 * @param text - Text to validate
 * @throws Error with descriptive message if validation fails
 */
function validateText(text: string): void {
  if (!text || !text.trim()) {
    throw new Error('Text cannot be empty')
  }
  if (text.length > MAX_TEXT_LENGTH) {
    throw new Error(`Text exceeds maximum length of ${MAX_TEXT_LENGTH.toLocaleString()} characters`)
  }
}

/**
 * Validate audio blob before sending to API.
 * Provides immediate feedback and prevents unnecessary API calls.
 *
 * @param audio - Audio blob to validate
 * @throws Error with descriptive message if validation fails
 */
function validateAudio(audio: Blob): void {
  if (audio.size === 0) {
    throw new Error('Audio file is empty')
  }
  const maxBytes = MAX_AUDIO_SIZE_MB * 1024 * 1024
  if (audio.size > maxBytes) {
    throw new Error(`Audio file exceeds maximum size of ${MAX_AUDIO_SIZE_MB}MB`)
  }
}

/**
 * Send audio to the prosodic detection endpoint.
 * @param audio - Audio blob from recording
 * @returns Promise with detection result
 * @throws Error with descriptive message if request fails
 */
export async function sendProsodicAudio(audio: Blob): Promise<ProsodicResponse> {
  // Validate audio before sending
  validateAudio(audio)

  // Generate unique request ID for tracking
  const requestId = generateRequestId()

  const formData = new FormData()
  const extension = getExtensionFromBlob(audio)
  formData.append('audio', audio, `recording${extension}`)

  let response: Response
  try {
    response = await fetchWithTimeout(`${API_BASE_URL}/api/prosodic`, {
      method: 'POST',
      headers: {
        'X-Request-ID': requestId,
      },
      body: formData,
    })
  } catch (error) {
    // Network error or timeout
    const message = error instanceof Error ? error.message : 'Network error'
    throw new Error(`[${requestId}] Failed to connect to server: ${message}`)
  }

  if (!response.ok) {
    let errorMessage: string
    try {
      // Try to parse JSON error response
      const errorData: unknown = await response.json()
      if (isErrorResponse(errorData)) {
        errorMessage = errorData.error
      } else {
        // Response is JSON but not in expected error format
        errorMessage = `HTTP ${response.status}`
      }
    } catch {
      // JSON parsing failed (might be HTML error page or empty response)
      const statusText = response.statusText || 'Unknown error'
      errorMessage = `HTTP ${response.status}: ${statusText}`
    }
    throw new Error(`[${requestId}] ${errorMessage}`)
  }

  // Parse successful response
  try {
    const data: unknown = await response.json()
    if (!isProsodicResponse(data)) {
      throw new Error(`[${requestId}] Invalid response format from server`)
    }
    return data
  } catch (error) {
    if (error instanceof Error && error.message.includes('Invalid response format from server')) {
      throw error
    }
    throw new Error(`[${requestId}] Invalid response format from server`)
  }
}

/**
 * Send text to the lexical detection endpoint.
 * @param text - Text to analyze for sarcasm
 * @returns Promise with detection result
 * @throws Error with descriptive message if request fails
 */
export async function sendLexicalText(text: string): Promise<LexicalResponse> {
  // Validate text before sending
  validateText(text)

  // Generate unique request ID for tracking
  const requestId = generateRequestId()

  let response: Response
  try {
    response = await fetchWithTimeout(`${API_BASE_URL}/api/lexical`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
      },
      body: JSON.stringify({ text }),
    })
  } catch (error) {
    // Network error or timeout
    const message = error instanceof Error ? error.message : 'Network error'
    throw new Error(`[${requestId}] Failed to connect to server: ${message}`)
  }

  if (!response.ok) {
    let errorMessage: string
    try {
      // Try to parse JSON error response
      const errorData: unknown = await response.json()
      if (isErrorResponse(errorData)) {
        errorMessage = errorData.error
      } else {
        // Response is JSON but not in expected error format
        errorMessage = `HTTP ${response.status}`
      }
    } catch {
      // JSON parsing failed (might be HTML error page or empty response)
      const statusText = response.statusText || 'Unknown error'
      errorMessage = `HTTP ${response.status}: ${statusText}`
    }
    throw new Error(`[${requestId}] ${errorMessage}`)
  }

  // Parse successful response
  try {
    const data: unknown = await response.json()
    if (!isLexicalResponse(data)) {
      throw new Error(`[${requestId}] Invalid response format from server`)
    }
    return data
  } catch (error) {
    if (error instanceof Error && error.message.includes('Invalid response format from server')) {
      throw error
    }
    throw new Error(`[${requestId}] Invalid response format from server`)
  }
}
