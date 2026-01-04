/**
 * Format bytes into a human-readable string (e.g., "150 MB")
 * Handles edge cases: negative numbers, NaN, and Infinity return "0 B"
 */
export function formatBytes(bytes: number): string {
  // Handle invalid inputs: NaN, Infinity, negative numbers
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '0 B'
  }

  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${Math.round(bytes / (1024 * 1024))} MB`
}
