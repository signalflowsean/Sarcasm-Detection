/**
 * Format bytes into a human-readable string (e.g., "150 MB")
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${Math.round(bytes / (1024 * 1024))} MB`
}
