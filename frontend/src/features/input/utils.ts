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

/**
 * Detects if the current device is running iOS (iPhone, iPad, iPod).
 * Includes iPadOS detection which reports as MacIntel but has touch support.
 */
export const isIOSDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  // iPadOS reports as MacIntel but has touch
  const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return /iPad|iPhone|iPod/.test(ua) || isIPadOS
}

/**
 * Detects if the current browser is running on a mobile device.
 * Used for applying mobile-specific workarounds (e.g., Web Speech API quirks).
 */
export const isMobileBrowser = (): boolean => {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false

  const ua = navigator.userAgent
  // Check for mobile/tablet user agents
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
  // Also check for touch devices that might be tablets
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 1
  // iPadOS reports as MacIntel but has touch
  const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return isMobileUA || isIPadOS || (isTouchDevice && window.innerWidth < 1024)
}
