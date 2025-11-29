import type { ReactNode } from 'react'

export const SMALL = 'small', LARGE = 'large';

export type WhichInputOption = {
  value: string
  name: string
  degrees: number
  icon?: ReactNode
}

export const DEFAULT_POSITIONS: WhichInputOption[] = [
  { value: 'off', name: 'Power', degrees: 0 },
  { value: 'text', name: 'Text', degrees: 120 },
  { value: 'audio', name: 'Audio', degrees: 240 },
]