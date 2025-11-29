import type { ReactNode } from 'react'

export const SMALL = 'small', LARGE = 'large';

export type WhichInputOption = {
  value: string
  name: string
  degrees: number
  icon?: ReactNode
}

export const DEFAULT_POSITIONS: WhichInputOption[] = [
  { value: 'off', name: 'Off', degrees: 0 },
  { value: 'text', name: 'Text', degrees: 120 },
  { value: 'audio', name: 'Audio', degrees: 240 },
]

/**
 * Maps rotary switch values to URL paths
 */
export const VALUE_TO_PATH: Record<string, string> = {
  off: '/getting-started',
  text: '/text-input',
  audio: '/audio-input',
}

/**
 * Maps URL paths to rotary switch values
 */
export const PATH_TO_VALUE: Record<string, string> = {
  '/': 'off',
  '/getting-started': 'off',
  '/text-input': 'text',
  '/audio-input': 'audio',
}

/**
 * Display labels for each input mode
 */
export const MODE_LABELS: Record<string, { title: string; action: string; description: string }> = {
  off: {
    title: 'Getting Started',
    action: 'Open getting started',
    description: 'Getting Started mode',
  },
  text: {
    title: 'Text Input',
    action: 'Open text input',
    description: 'Text Input mode',
  },
  audio: {
    title: 'Audio Recorder',
    action: 'Open audio recorder',
    description: 'Audio Recorder mode',
  },
}