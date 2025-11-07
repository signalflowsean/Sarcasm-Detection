import { forwardRef, useRef } from 'react'
import { clamp01 } from '../utils'

type Props = {
  label?: string
  showPlayhead?: boolean
  playheadPercent?: number // 0..1
  isSeekEnabled?: boolean
  onSeekPercent?: (percent: number) => void
  showEmpty?: boolean
  emptyMessage?: string
}

const Waveform = forwardRef<HTMLCanvasElement, Props>(function Waveform({ label = 'Waveform', showPlayhead, playheadPercent = 0, isSeekEnabled, onSeekPercent, showEmpty, emptyMessage }, ref) {
  const containerRef = useRef<HTMLDivElement>(null)

  const isScrubbingRef = useRef(false)
  const seekAtClientX = (clientX: number) => {
    if (!isSeekEnabled || !onSeekPercent) return
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const percent = clamp01((clientX - rect.left) / rect.width)
    onSeekPercent(percent)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (!isSeekEnabled) return
    e.stopPropagation() // prevent modal from intercepting
    isScrubbingRef.current = true
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch { /* ignore if not supported */ }
    seekAtClientX(e.clientX)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isSeekEnabled || !isScrubbingRef.current) return
    e.stopPropagation()
    seekAtClientX(e.clientX)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (!isSeekEnabled) return
    e.stopPropagation()
    isScrubbingRef.current = false
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch { /* ignore if not supported */ }
  }

  // Touch fallback for browsers with inconsistent PointerEvent behavior
  const onTouchStart = (e: React.TouchEvent) => {
    if (!isSeekEnabled) return
    e.stopPropagation()
    isScrubbingRef.current = true
    const t = e.touches[0]
    if (t) seekAtClientX(t.clientX)
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (!isSeekEnabled || !isScrubbingRef.current) return
    e.stopPropagation()
    const t = e.touches[0]
    if (t) seekAtClientX(t.clientX)
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!isSeekEnabled) return
    e.stopPropagation()
    isScrubbingRef.current = false
  }
  const onTouchCancel = (e: React.TouchEvent) => {
    if (!isSeekEnabled) return
    e.stopPropagation()
    isScrubbingRef.current = false
  }

  return (
    <div
      ref={containerRef}
      className={`audio-recorder__waveform${isSeekEnabled ? ' is-seekable' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
    >
      <canvas ref={ref} width={600} height={120} aria-label={label} />
      {showPlayhead && (
        <div
          className="audio-recorder__playhead"
          style={{ left: `${Math.min(100, Math.max(0, playheadPercent * 100))}%` }}
          aria-hidden="true"
        />
      )}
      {showEmpty && (
        <div className="audio-recorder__waveform__empty" aria-hidden="true">
          {emptyMessage || 'Press Down on Microphone to Record'}
        </div>
      )}
    </div>
  )
})

export default Waveform


