/**
 * Format bytes into a human-readable string with appropriate unit (B, KB, MB, GB, TB)
 * Handles edge cases: negative numbers, NaN, and Infinity return "0 B"
 * Shows one decimal place for values under 10 in each unit for better precision
 *
 * Examples:
 * - 512 → "512 B"
 * - 2048 → "2 KB"
 * - 5.5 * 1024 → "5.5 KB"
 * - 150 * 1024 * 1024 → "150 MB"
 * - 1.5 * 1024 * 1024 * 1024 → "1.5 GB"
 */
export function formatBytes(bytes: number): string {
  // Handle invalid inputs: NaN, Infinity, negative numbers
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '0 B'
  }

  // Define units and thresholds
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const threshold = 1024

  // Bytes - no conversion needed
  if (bytes < threshold) {
    return `${Math.round(bytes)} B`
  }

  // Find the appropriate unit
  let unitIndex = 0
  let value = bytes

  while (value >= threshold && unitIndex < units.length - 1) {
    value /= threshold
    unitIndex++
  }

  // Format with 1 decimal place for values under 10, otherwise round
  const formatted = value < 10 ? value.toFixed(1) : Math.round(value).toString()
  return `${formatted} ${units[unitIndex]}`
}
