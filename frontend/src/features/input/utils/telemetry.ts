/**
 * Telemetry & Metrics Collection (Dev Mode Only)
 *
 * Lightweight dev-only telemetry for testing and comparing Moonshine models locally.
 * This does NOT send data anywhere - it only stores metrics in localStorage for
 * developers to review and compare different models.
 *
 * Usage:
 * 1. Switch models using the ModelSelector component
 * 2. Record speech and use the app normally
 * 3. Open browser console and run: window.viewMoonshineMetrics()
 * 4. Review the table to compare model performance
 */

export interface ModelMetrics {
  /** Which model was used (e.g., 'model/tiny', 'model/base') */
  modelName: string
  /** Time taken to load the model in milliseconds */
  loadTimeMs: number
  /** Whether model was loaded from cache (true) or downloaded (false) */
  cacheHit: boolean
  /** Estimated network speed in Mbps (if available from browser API) */
  networkSpeedEstimate?: number
  /** Length of transcribed text */
  transcriptLength: number
  /** Timestamp when metric was recorded */
  timestamp: number
  /** Whether transcription was successful */
  success: boolean
  /** Error message if transcription failed */
  errorMessage?: string
}

/**
 * Track model performance metrics (dev mode only)
 *
 * @param metrics - Model performance data to track
 */
export function trackModelPerformance(metrics: ModelMetrics) {
  // Only track in dev mode
  if (import.meta.env.MODE !== 'development') {
    return
  }

  try {
    const existing = JSON.parse(localStorage.getItem('moonshine_metrics') || '[]')
    existing.push(metrics)
    // Keep last 100 metrics to avoid localStorage overflow
    const trimmed = existing.slice(-100)
    localStorage.setItem('moonshine_metrics', JSON.stringify(trimmed))
  } catch (error) {
    if (import.meta.env.MODE === 'development') {
      console.error('Failed to store telemetry:', error)
    }
  }
}

/**
 * View collected metrics in console (dev mode only)
 *
 * @returns Array of metrics or undefined if not in dev mode
 */
export function viewMetrics(): ModelMetrics[] | undefined {
  if (import.meta.env.MODE !== 'development') {
    // Silently return in production (no console output)
    return
  }

  try {
    const metrics = JSON.parse(localStorage.getItem('moonshine_metrics') || '[]') as ModelMetrics[]

    if (metrics.length === 0) {
      if (import.meta.env.MODE === 'development') {
        console.log(
          'No metrics collected yet. Use the app to record speech and metrics will be tracked.'
        )
      }
      return []
    }

    // Display as table for easy comparison
    if (import.meta.env.MODE === 'development') {
      console.table(
        metrics.map(m => ({
          Model: m.modelName,
          'Load Time (s)': (m.loadTimeMs / 1000).toFixed(2),
          'Cache Hit': m.cacheHit ? '✓' : '✗',
          'Network (Mbps)': m.networkSpeedEstimate?.toFixed(1) || 'N/A',
          'Transcript Len': m.transcriptLength,
          Success: m.success ? '✓' : '✗',
          Time: new Date(m.timestamp).toLocaleTimeString(),
        }))
      )
    }

    // Summary statistics
    const byModel = metrics.reduce(
      (acc, m) => {
        if (!acc[m.modelName]) {
          acc[m.modelName] = { count: 0, totalLoadTime: 0, cacheHits: 0, successes: 0 }
        }
        acc[m.modelName].count++
        acc[m.modelName].totalLoadTime += m.loadTimeMs
        if (m.cacheHit) acc[m.modelName].cacheHits++
        if (m.success) acc[m.modelName].successes++
        return acc
      },
      {} as Record<
        string,
        { count: number; totalLoadTime: number; cacheHits: number; successes: number }
      >
    )

    if (import.meta.env.MODE === 'development') {
      console.log('\n📊 Summary by Model:')
      Object.entries(byModel).forEach(([model, stats]) => {
        const avgLoadTime = (stats.totalLoadTime / stats.count / 1000).toFixed(2)
        const cacheRate = ((stats.cacheHits / stats.count) * 100).toFixed(0)
        const successRate = ((stats.successes / stats.count) * 100).toFixed(0)
        console.log(
          `${model}: ${stats.count} samples, avg load ${avgLoadTime}s, ${cacheRate}% cached, ${successRate}% success`
        )
      })
    }

    return metrics
  } catch (error) {
    if (import.meta.env.MODE === 'development') {
      console.error('Failed to retrieve metrics:', error)
    }
    return []
  }
}

/**
 * Clear all collected metrics (dev mode only)
 */
export function clearMetrics() {
  if (import.meta.env.MODE !== 'development') {
    // Silently return in production (no console output)
    return
  }

  localStorage.removeItem('moonshine_metrics')
  if (import.meta.env.MODE === 'development') {
    console.log('✓ Metrics cleared')
  }
}

/**
 * Get estimated network speed using Network Information API
 *
 * @returns Estimated download speed in Mbps, or undefined if not available
 */
export function getNetworkSpeedEstimate(): number | undefined {
  // @ts-expect-error - NetworkInformation is experimental
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection

  if (connection && 'downlink' in connection) {
    return connection.downlink // Returns Mbps
  }

  return undefined
}

// Expose metrics functions globally in dev mode for easy console access
if (import.meta.env.MODE === 'development') {
  // @ts-expect-error - Adding to window for dev convenience
  window.viewMoonshineMetrics = viewMetrics
  // @ts-expect-error - Adding to window for dev convenience
  window.clearMoonshineMetrics = clearMetrics

  console.log(
    '🛠️ Dev Mode: Moonshine telemetry enabled.\n' +
      'Run window.viewMoonshineMetrics() to see collected metrics.\n' +
      'Run window.clearMoonshineMetrics() to clear all metrics.'
  )
}
