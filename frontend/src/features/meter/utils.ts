import type { Tick } from './types'
import { SMALL, LARGE } from './constants'

export const generateTicks = ({
  numberOfTicks = 7,
  largeTickInterval = 2
}): Tick[] =>
  Array.from({ length: numberOfTicks }, (_, i) => ({
    uuid: crypto.randomUUID(),
    size: i % largeTickInterval === 0 ? LARGE : SMALL,
    rotation: -90 + (i / (numberOfTicks - 1)) * 180
  }))

export const TICKS: Tick[] = generateTicks({});
