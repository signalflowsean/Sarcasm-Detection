import { useEffect, useState } from 'react'
import { isDev } from '../utils/env'

// Shared state across all hook instances
let sharedOverrideState = false
const listeners = new Set<(value: boolean) => void>()

/**
 * Dev-mode only hook for toggling the speech-to-text loading spinner.
 * Press "j" key to toggle the spinner on/off.
 * State is shared across all hook instances.
 *
 * @returns The current override state (true = show loading spinner)
 */
export function useDevLoadingOverride(): boolean {
  const [override, setOverride] = useState(sharedOverrideState)

  useEffect(() => {
    if (!isDev()) return

    // Register this component's setter
    const updateState = (value: boolean) => setOverride(value)
    const isFirstListener = listeners.size === 0
    listeners.add(updateState)

    // Set up keyboard handler only once (first hook instance)
    let handleKeyDown: ((e: KeyboardEvent) => void) | null = null

    if (isFirstListener) {
      handleKeyDown = (e: KeyboardEvent) => {
        if (e.code !== 'KeyJ') return
        if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return

        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

        e.preventDefault()
        sharedOverrideState = !sharedOverrideState
        if (isDev()) {
          console.log(
            `🔧 Dev mode: Loading spinner ${sharedOverrideState ? 'shown' : 'hidden'} (press J again to toggle)`
          )
        }
        // Notify all listeners
        listeners.forEach(listener => listener(sharedOverrideState))
      }

      window.addEventListener('keydown', handleKeyDown)
    }

    // Cleanup: remove listener and event handler if this instance added it and it's the last one
    return () => {
      listeners.delete(updateState)
      if (isFirstListener && handleKeyDown && listeners.size === 0) {
        window.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [])

  return override
}
