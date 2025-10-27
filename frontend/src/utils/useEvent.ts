import React, { useLayoutEffect, useCallback, useRef } from 'react'

type EffectEventFn = <U extends unknown[]>(fn: (...a: U) => void) => (...a: U) => void

export function useEvent<TArgs extends unknown[]>(handler: (...args: TArgs) => void): (...args: TArgs) => void {
  // Always set up fallback hooks to satisfy the Rules of Hooks
  const handlerRef = useRef(handler)
  useLayoutEffect(() => { handlerRef.current = handler })
  const fallback = useCallback((...args: TArgs) => handlerRef.current(...args), [])

  // Prefer React's built-in if available
  const builtIn = (React as unknown as { useEffectEvent?: EffectEventFn }).useEffectEvent
  return typeof builtIn === 'function' ? builtIn(handler) : fallback
}

export default useEvent


