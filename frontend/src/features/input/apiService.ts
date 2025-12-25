/**
 * API service for sarcasm detection endpoints.
 * Communicates with the Flask backend for lexical and prosodic analysis.
 */

// In Docker: empty string makes URLs relative (nginx proxies /api/* to backend)
// In development: falls back to direct backend connection
const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'

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

/**
 * Send audio to the prosodic detection endpoint.
 * @param audio - Audio blob from recording
 * @returns Promise with detection result
 * @throws Error with descriptive message if request fails
 */
export async function sendProsodicAudio(audio: Blob): Promise<ProsodicResponse> {
  const formData = new FormData()
  const extension = getExtensionFromBlob(audio)
  formData.append('audio', audio, `recording${extension}`)

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/api/prosodic`, {
      method: 'POST',
      body: formData,
    })
  } catch (error) {
    // Network error (no response received)
    const message = error instanceof Error ? error.message : 'Network error'
    throw new Error(`Failed to connect to server: ${message}`)
  }

  if (!response.ok) {
    let errorMessage = 'Request failed'
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
    throw new Error(errorMessage)
  }

  // Parse successful response
  try {
    const data: unknown = await response.json()
    if (!isProsodicResponse(data)) {
      throw new Error('Invalid response format from server')
    }
    return data
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid response format from server') {
      throw error
    }
    throw new Error('Invalid response format from server')
  }
}

/**
 * Send text to the lexical detection endpoint.
 * @param text - Text to analyze for sarcasm
 * @returns Promise with detection result
 * @throws Error with descriptive message if request fails
 */
export async function sendLexicalText(text: string): Promise<LexicalResponse> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/api/lexical`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    })
  } catch (error) {
    // Network error (no response received)
    const message = error instanceof Error ? error.message : 'Network error'
    throw new Error(`Failed to connect to server: ${message}`)
  }

  if (!response.ok) {
    let errorMessage = 'Request failed'
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
    throw new Error(errorMessage)
  }

  // Parse successful response
  try {
    const data: unknown = await response.json()
    if (!isLexicalResponse(data)) {
      throw new Error('Invalid response format from server')
    }
    return data
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid response format from server') {
      throw error
    }
    throw new Error('Invalid response format from server')
  }
}
