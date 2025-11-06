export const formatDuration = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const m = minutes.toString().padStart(2, '0')
  const s = seconds.toString().padStart(2, '0')
  return `${m}:${s}`
}

export const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))




