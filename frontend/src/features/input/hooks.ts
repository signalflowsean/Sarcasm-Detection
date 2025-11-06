import { useCallback, useEffect, useRef, useState } from 'react'

export const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState<boolean>(() => typeof window !== 'undefined' ? window.matchMedia(query).matches : false)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches)
    const mqlAny = mql as unknown as {
      addEventListener?: (type: string, listener: (e: MediaQueryListEvent) => void) => void
      removeEventListener?: (type: string, listener: (e: MediaQueryListEvent) => void) => void
      addListener?: (listener: (e: MediaQueryListEvent) => void) => void
      removeListener?: (listener: (e: MediaQueryListEvent) => void) => void
    }
    if (mqlAny.addEventListener) mqlAny.addEventListener('change', onChange)
    else mqlAny.addListener?.(onChange)
    setMatches(mql.matches)
    return () => {
      if (mqlAny.removeEventListener) mqlAny.removeEventListener('change', onChange)
      else mqlAny.removeListener?.(onChange)
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




