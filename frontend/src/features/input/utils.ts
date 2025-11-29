export const formatDuration = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const m = minutes.toString().padStart(2, '0')
  const s = seconds.toString().padStart(2, '0')
  return `${m}:${s}`
}

export const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))

/**
 * Detects if the current platform is Mac/iOS using modern platform detection APIs.
 * Prefers navigator.userAgentData over deprecated navigator.platform.
 */
export const isMacPlatform = (): boolean => {
  if (typeof navigator === 'undefined') return false
  
  // Modern approach: User-Agent Client Hints API
  // @ts-expect-error - userAgentData is not yet in all TypeScript definitions
  if (navigator.userAgentData?.platform) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return /Mac|iPhone|iPad|iPod/.test(navigator.userAgentData.platform)
  }
  
  // Fallback: Check userAgent string
  if (navigator.userAgent) {
    return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)
  }
  
  // Last resort: deprecated platform property
  if (navigator.platform) {
    return /Mac|iPhone|iPad|iPod/.test(navigator.platform)
  }
  
  return false
}




