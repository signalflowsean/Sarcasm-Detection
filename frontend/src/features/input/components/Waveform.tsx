import { forwardRef, useRef } from 'react'
import { clamp01 } from '../utils'

type Props = {
  label?: string
  showPlayhead?: boolean
  playheadPercent?: number // 0..1
  isSeekEnabled?: boolean
  onSeekPercent?: (percent: number) => void
}

const Waveform = forwardRef<HTMLCanvasElement, Props>(function Waveform({ label = 'Waveform', showPlayhead, playheadPercent = 0, isSeekEnabled, onSeekPercent }, ref) {
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
    isScrubbingRef.current = true
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    seekAtClientX(e.clientX)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isSeekEnabled) return
    const current = e.currentTarget as HTMLElement & { hasPointerCapture?: (pointerId: number) => boolean }
    if (isScrubbingRef.current || current.hasPointerCapture?.(e.pointerId)) {
      seekAtClientX(e.clientX)
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (!isSeekEnabled) return
    isScrubbingRef.current = false
    ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
  }

  return (
    <div
      ref={containerRef}
      className={`audio-recorder__waveform${isSeekEnabled ? ' is-seekable' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <canvas ref={ref} width={600} height={120} aria-label={label} />
      {showPlayhead && (
        <div
          className="audio-recorder__playhead"
          style={{ left: `${Math.min(100, Math.max(0, playheadPercent * 100))}%` }}
          aria-hidden="true"
        />
      )}
    </div>
  )
})

export default Waveform


