/**
 * API service for sarcasm detection endpoints.
 * Communicates with the Flask backend for lexical and prosodic analysis.
 */

// In Docker: empty string makes URLs relative (nginx proxies /api/* to backend)
// In development: falls back to direct backend connection
const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';

export type ProsodicResponse = {
  id: string;
  value: number; // 0.0–1.0 inclusive
  reliable: boolean; // true if from real ML model, false if fallback
};

export type LexicalResponse = {
  id: string;
  value: number; // 0.0–1.0 inclusive
  reliable: boolean; // true if from real ML model, false if fallback
};

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
};

/**
 * Get file extension from blob MIME type.
 * Defaults to .webm for unknown types (most common browser recording format).
 */
function getExtensionFromBlob(blob: Blob): string {
  return MIME_TO_EXTENSION[blob.type] ?? '.webm';
}

/**
 * Send audio to the prosodic detection endpoint.
 * @param audio - Audio blob from recording
 * @returns Promise with detection result
 */
export async function sendProsodicAudio(audio: Blob): Promise<ProsodicResponse> {
  const formData = new FormData();
  const extension = getExtensionFromBlob(audio);
  formData.append('audio', audio, `recording${extension}`);

  const response = await fetch(`${API_BASE_URL}/api/prosodic`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Send text to the lexical detection endpoint.
 * @param text - Text to analyze for sarcasm
 * @returns Promise with detection result
 */
export async function sendLexicalText(text: string): Promise<LexicalResponse> {
  const response = await fetch(`${API_BASE_URL}/api/lexical`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}
