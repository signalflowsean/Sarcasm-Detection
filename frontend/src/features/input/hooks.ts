import { useCallback, useEffect, useRef, useState } from 'react'

type LegacyMediaQueryList = MediaQueryList & {
  addListener?: (listener: (e: MediaQueryListEvent) => void) => void
  removeListener?: (listener: (e: MediaQueryListEvent) => void) => void
}

export const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState<boolean>(() => typeof window !== 'undefined' ? window.matchMedia(query).matches : false)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches)
    // Prefer standard EventTarget API (widely supported since ~2020); fallback for older Safari
    if (typeof (mql as MediaQueryList).addEventListener === 'function') {
      mql.addEventListener('change', onChange)
    } else {
      ;(mql as LegacyMediaQueryList).addListener?.(onChange)
    }
    setMatches(mql.matches)
    return () => {
      if (typeof (mql as MediaQueryList).removeEventListener === 'function') {
        mql.removeEventListener('change', onChange)
      } else {
        ;(mql as LegacyMediaQueryList).removeListener?.(onChange)
      }
    }
  }, [query])
  return matches
}

export const useBodyScrollLock = (locked: boolean) => {
  useEffect(() => {
    const original = document.body.style.overflow
    if (locked) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = original
    }
  }, [locked])
}

export const useRafInterval = (fn: () => void, active: boolean) => {
  const rafId = useRef<number | null>(null)
  const loop = useCallback(() => {
    fn()
    rafId.current = requestAnimationFrame(loop)
  }, [fn])
  useEffect(() => {
    if (!active) return
    rafId.current = requestAnimationFrame(loop)
    return () => {
      if (rafId.current != null) cancelAnimationFrame(rafId.current)
    }
  }, [active, loop])
}




