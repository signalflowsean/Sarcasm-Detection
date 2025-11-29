import React, { useState } from 'react'
import type { WhichInputOption } from './constants'
import { DEFAULT_POSITIONS } from './constants'
import { WhichInputCtx, type WhichInputContext } from './useWhichInput'

type ProviderProps = {
  children: React.ReactNode
  positions?: WhichInputOption[]
}

/**
 * Maps URL paths to rotary switch values for initial load
 */
const PATH_TO_VALUE: Record<string, string> = {
  '/': 'off',
  '/getting-started': 'off',
  '/text-input': 'text',
  '/audio-input': 'audio',
}

/**
 * Get initial index based on current URL pathname
 */
function getInitialIndex(positions: WhichInputOption[]): number {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/'
  const targetValue = PATH_TO_VALUE[pathname]
  
  if (targetValue) {
    const index = positions.findIndex(p => p.value === targetValue)
    if (index !== -1) return index
  }
  
  return 0
}

export function WhichInputProvider({ children, positions }: ProviderProps) {
  const normalized = (positions && positions.length > 0 ? positions : DEFAULT_POSITIONS).map(p => ({
    ...p,
    degrees: ((p.degrees % 360) + 360) % 360,
  }))

  const [index, setIndex] = useState(() => getInitialIndex(normalized))
  const value = normalized[Math.max(0, Math.min(index, normalized.length - 1))]?.value ?? normalized[0].value

  const setValue = (v: string) => {
    const i = normalized.findIndex(p => p.value === v)
    if (i !== -1) setIndex(i)
  }

  const next = () => {
    setIndex(prev => (prev + 1) % normalized.length)
  }

  const prev = () => {
    setIndex(prev => (prev - 1 + normalized.length) % normalized.length)
  }

  const ctx: WhichInputContext = {
    positions: normalized,
    index,
    value,
    setIndex,
    setValue,
    next,
    prev,
  }

  return <WhichInputCtx.Provider value={ctx}>{children}</WhichInputCtx.Provider>
}
