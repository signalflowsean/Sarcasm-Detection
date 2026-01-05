/**
 * Format bytes into a human-readable string (e.g., "150 MB")
 * Handles edge cases: negative numbers, NaN, and Infinity return "0 B"
 * Shows one decimal place for values under 10 KB/MB for better precision
 */
export function formatBytes(bytes: number): string {
  // Handle invalid inputs: NaN, Infinity, negative numbers
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '0 B'
  }

  if (bytes < 1024) {
    return `${Math.round(bytes)} B`
  }

  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024
    return kb < 10 ? `${kb.toFixed(1)} KB` : `${Math.round(kb)} KB`
  }

  const mb = bytes / (1024 * 1024)
  return mb < 10 ? `${mb.toFixed(1)} MB` : `${Math.round(mb)} MB`
}
