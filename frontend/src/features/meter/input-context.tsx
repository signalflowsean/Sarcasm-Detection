import React, { useState } from 'react'
import type { WhichInputOption } from './constants'
import { DEFAULT_POSITIONS } from './constants'
import { WhichInputCtx, type WhichInputContext } from './use-which-input'

type ProviderProps = {
  children: React.ReactNode
  positions?: WhichInputOption[]
}

export function WhichInputProvider({ children, positions }: ProviderProps) {
  const normalized = (positions && positions.length > 0 ? positions : DEFAULT_POSITIONS).map(p => ({
    ...p,
    degrees: ((p.degrees % 360) + 360) % 360,
  }))

  const [index, setIndex] = useState(0)
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
