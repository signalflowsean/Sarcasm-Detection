import { createContext, useContext } from 'react'

export type WhichInputContext = {
  positions: { value: string; name: string; degrees: number; icon?: React.ReactNode }[]
  index: number
  value: string
  setIndex: (i: number) => void
  setValue: (v: string) => void
  next: () => void
  prev: () => void
}

export const WhichInputCtx = createContext<WhichInputContext | null>(null)

export function useWhichInput(): WhichInputContext {
  const context = useContext(WhichInputCtx)
  if (!context) throw new Error('useWhichInput must be used within a WhichInputProvider')
  return context
}