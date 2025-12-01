import React, { useEffect, useRef, useState, useEffectEvent } from 'react'
import { useWhichInput } from '../useWhichInput'
import { DefaultIcon } from './icons'
import { normalizeDegrees, circularDistance, angleFromPoints } from '../utils'

type CSSVarProps = React.CSSProperties & Record<`--${string}`, string | number>

const STORAGE_KEY = 'sarcasm-detector-visited'

const RotarySwitch: React.FC = () => {
  const { positions, index, setIndex, next, prev } = useWhichInput()
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  // Initialize first-time state directly from localStorage (lazy init for SSR safety)
  const [isFirstTime, setIsFirstTime] = useState(() => {
    if (typeof window === 'undefined') return false
    return !localStorage.getItem(STORAGE_KEY)
  })
  const ref = useRef<HTMLDivElement | null>(null)

  const activeIndex = dragIndex ?? index
  const angleNow = normalizeDegrees(positions[activeIndex]?.degrees ?? 0)
  const knobVars: CSSVarProps = { '--angle-deg': `${angleNow}deg` }

  const dismissFirstTime = useEffectEvent(() => {
    if (isFirstTime) {
      localStorage.setItem(STORAGE_KEY, 'true')
      setIsFirstTime(false)
    }
  })

  const handleKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      prev()
      dismissFirstTime()
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      next()
      dismissFirstTime()
    } else if (e.key === 'Home') {
      e.preventDefault()
      setIndex(0)
      dismissFirstTime()
    } else if (e.key === 'End') {
      e.preventDefault()
      setIndex(positions.length - 1)
      dismissFirstTime()
    }
  })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const controller = new AbortController()
    const { signal } = controller
    el.addEventListener('keydown', handleKey, { signal })
    return () => controller.abort()
  }, [handleKey])

  const updateByEvent = useEffectEvent((e: PointerEvent) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const x = e.clientX
    const y = e.clientY
    const deg = angleFromPoints(x, y, cx, cy)
    let bestIdx = 0
    let bestDist = Number.POSITIVE_INFINITY
    for (let i = 0; i < positions.length; i++) {
      const d = circularDistance(deg, positions[i].degrees)
      if (d < bestDist) { bestDist = d; bestIdx = i }
    }
    setDragIndex(bestIdx)
  })

  const onPointerDown = useEffectEvent((e: PointerEvent) => {
    const el = ref.current
    if (!el) return
    el.setPointerCapture(e.pointerId)
    updateByEvent(e)
  })

  const onPointerMove = useEffectEvent((e: PointerEvent) => {
    const el = ref.current
    if (el && el.hasPointerCapture(e.pointerId)) updateByEvent(e)
  })

  const onPointerUp = useEffectEvent((e: PointerEvent) => {
    const el = ref.current
    if (dragIndex !== null) {
      if (dragIndex !== index) setIndex(dragIndex)
      setDragIndex(null)
    }
    if (el && el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
    dismissFirstTime()
  })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const controller = new AbortController()
    const { signal } = controller
    el.addEventListener('pointerdown', onPointerDown, { signal })
    window.addEventListener('pointermove', onPointerMove, { signal })
    window.addEventListener('pointerup', onPointerUp, { signal })
    window.addEventListener('pointercancel', onPointerUp, { signal })
    return () => controller.abort()
  }, [onPointerDown, onPointerMove, onPointerUp])

  const ariaValueText = positions[index]?.name ?? ''

  return (
    <div
      tabIndex={0}
      ref={ref}
      className="rotary"
      role="slider"
      aria-label="Input source selector"
      aria-valuemin={0}
      aria-valuemax={positions.length - 1}
      aria-valuenow={index}
      aria-valuetext={ariaValueText}
      data-angle={angleNow}
      onClick={(e) => { e.preventDefault() }}
      onDoubleClick={(e) => { e.preventDefault() }}
      style={knobVars}
    >
      <span className="rotary__plate" aria-hidden />
      <span className={`rotary__knob ${isFirstTime ? 'rotary__knob--pulse' : ''}`} data-role="knob" aria-hidden />
      {positions.map((p, i) => (
        <span
          key={p.value}
          className={`rotary__icon rotary__icon--${p.value} ${i === index ? 'is-active' : ''}`}
          style={{ '--deg': `${normalizeDegrees(p.degrees)}deg` } as CSSVarProps}
          title={p.name}
          aria-hidden
        >
          <span className="rotary__icon__glyph">{p.icon ?? <DefaultIcon value={p.value} />}</span>
        </span>
      ))}
      {/* <span className="rotary__label" aria-live="polite">{ariaValueText}</span> */}
    </div>
  )
}

export default RotarySwitch