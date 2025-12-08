import { useEffect, useRef, useState } from 'react'

type LegacyMediaQueryList = MediaQueryList & {
  addListener?: (listener: (e: MediaQueryListEvent) => void) => void
  removeListener?: (listener: (e: MediaQueryListEvent) => void) => void
}

export const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  )
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
  const originalOverflowRef = useRef<string | null>(null)

  useEffect(() => {
    // Capture the original overflow value only once
    if (originalOverflowRef.current === null) {
      originalOverflowRef.current = document.body.style.overflow
    }

    if (locked) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = originalOverflowRef.current
    }

    return () => {
      // Restore original value on unmount
      if (originalOverflowRef.current !== null) {
        document.body.style.overflow = originalOverflowRef.current
      }
    }
  }, [locked])
}

export const useRafInterval = (fn: () => void, active: boolean) => {
  const rafId = useRef<number | null>(null)
  const fnRef = useRef(fn)

  useEffect(() => {
    fnRef.current = fn
  }, [fn])

  useEffect(() => {
    if (!active) return

    const loop = () => {
      fnRef.current()
      rafId.current = requestAnimationFrame(loop)
    }

    rafId.current = requestAnimationFrame(loop)
    return () => {
      if (rafId.current != null) cancelAnimationFrame(rafId.current)
    }
  }, [active])
}
