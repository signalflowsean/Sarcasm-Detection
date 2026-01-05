import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ModelMetrics } from './telemetry'
import {
  clearMetrics,
  getNetworkSpeedEstimate,
  trackModelPerformance,
  viewMetrics,
} from './telemetry'

// Mock the env utility - import.meta.env can't be mocked with vi.stubEnv()
vi.mock('./env', () => ({
  isDev: vi.fn(() => true), // Default to dev mode, tests can override
  isProd: vi.fn(() => false),
}))

import * as envUtils from './env'

describe('telemetry', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>
  let consoleTableSpy: ReturnType<typeof vi.spyOn>
  let localStorageMock: { [key: string]: string }

  beforeEach(() => {
    // Default to dev mode for most tests
    vi.mocked(envUtils.isDev).mockReturnValue(true)

    // Mock console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    consoleTableSpy = vi.spyOn(console, 'table').mockImplementation(() => {})

    // Mock localStorage
    localStorageMock = {}
    const mockLocalStorage = {
      getItem: vi.fn((key: string) => localStorageMock[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageMock[key] = value
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageMock[key]
      }),
      clear: vi.fn(() => {
        localStorageMock = {}
      }),
      length: 0,
      key: vi.fn(),
    }
    vi.stubGlobal('localStorage', mockLocalStorage)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  describe('trackModelPerformance', () => {
    const mockMetrics: ModelMetrics = {
      modelName: 'model/base',
      loadTimeMs: 5000,
      cacheHit: false,
      networkSpeedEstimate: 50.5,
      transcriptLength: 42,
      timestamp: Date.now(),
      success: true,
    }

    it('should store metrics in localStorage in dev mode', async () => {
      trackModelPerformance(mockMetrics)

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'moonshine_metrics',
        expect.stringContaining(mockMetrics.modelName)
      )

      const stored = JSON.parse(localStorageMock['moonshine_metrics'])
      expect(stored).toHaveLength(1)
      expect(stored[0]).toEqual(mockMetrics)
    })

    it('should not store metrics in production mode', async () => {
      vi.mocked(envUtils.isDev).mockReturnValue(false)

      trackModelPerformance(mockMetrics)

      expect(localStorage.setItem).not.toHaveBeenCalled()
    })

    it('should append to existing metrics', async () => {
      const firstMetrics: ModelMetrics = {
        ...mockMetrics,
        modelName: 'model/tiny',
      }
      const secondMetrics: ModelMetrics = {
        ...mockMetrics,
        modelName: 'model/base',
      }

      trackModelPerformance(firstMetrics)
      trackModelPerformance(secondMetrics)

      const stored = JSON.parse(localStorageMock['moonshine_metrics'])
      expect(stored).toHaveLength(2)
      expect(stored[0].modelName).toBe('model/tiny')
      expect(stored[1].modelName).toBe('model/base')
    })

    it('should trim to last 100 metrics', async () => {
      // Create 105 metrics
      const manyMetrics = Array.from({ length: 105 }, (_, i) => ({
        ...mockMetrics,
        timestamp: i,
      }))

      manyMetrics.forEach(metric => trackModelPerformance(metric))

      const stored = JSON.parse(localStorageMock['moonshine_metrics'])
      expect(stored).toHaveLength(100)
      // Should keep the last 100 (timestamps 5-104)
      expect(stored[0].timestamp).toBe(5)
      expect(stored[99].timestamp).toBe(104)
    })

    it('should handle localStorage errors gracefully', async () => {
      // Make localStorage.setItem throw
      vi.mocked(localStorage.setItem).mockImplementationOnce(() => {
        throw new Error('QuotaExceededError')
      })

      // Should not throw
      expect(() => trackModelPerformance(mockMetrics)).not.toThrow()

      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to store telemetry:', expect.any(Error))
    })

    it('should handle corrupted localStorage data', async () => {
      // Set invalid JSON in localStorage
      localStorageMock['moonshine_metrics'] = 'invalid json {'

      // Should not throw and should replace with new array
      expect(() => trackModelPerformance(mockMetrics)).not.toThrow()
    })
  })

  describe('viewMetrics', () => {
    it('should return empty array when no metrics exist', async () => {
      const result = viewMetrics()

      expect(result).toEqual([])
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('No metrics collected yet')
      )
    })

    it('should display metrics table when metrics exist', async () => {
      const metrics: ModelMetrics[] = [
        {
          modelName: 'model/tiny',
          loadTimeMs: 3000,
          cacheHit: false,
          networkSpeedEstimate: 25.5,
          transcriptLength: 42,
          timestamp: Date.now(),
          success: true,
        },
        {
          modelName: 'model/base',
          loadTimeMs: 5000,
          cacheHit: true,
          transcriptLength: 38,
          timestamp: Date.now(),
          success: true,
        },
      ]

      localStorageMock['moonshine_metrics'] = JSON.stringify(metrics)

      const result = viewMetrics()

      expect(result).toEqual(metrics)
      expect(consoleTableSpy).toHaveBeenCalled()
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('📊 Summary by Model'))
    })

    it('should calculate summary statistics correctly', async () => {
      const metrics: ModelMetrics[] = [
        {
          modelName: 'model/tiny',
          loadTimeMs: 2000,
          cacheHit: false,
          transcriptLength: 10,
          timestamp: Date.now(),
          success: true,
        },
        {
          modelName: 'model/tiny',
          loadTimeMs: 1000,
          cacheHit: true,
          transcriptLength: 20,
          timestamp: Date.now(),
          success: true,
        },
        {
          modelName: 'model/base',
          loadTimeMs: 5000,
          cacheHit: false,
          transcriptLength: 30,
          timestamp: Date.now(),
          success: false,
        },
      ]

      localStorageMock['moonshine_metrics'] = JSON.stringify(metrics)

      viewMetrics()

      // Check that summary contains correct calculations
      // model/tiny: 2 samples, avg 1.5s, 50% cached, 100% success
      // model/base: 1 sample, avg 5.0s, 0% cached, 0% success
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('model/tiny: 2 samples, avg load 1.50s, 50% cached, 100% success')
      )
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('model/base: 1 samples, avg load 5.00s, 0% cached, 0% success')
      )
    })

    it('should handle metrics with errors', async () => {
      const metrics: ModelMetrics[] = [
        {
          modelName: 'model/base',
          loadTimeMs: 5000,
          cacheHit: false,
          transcriptLength: 0,
          timestamp: Date.now(),
          success: false,
          errorMessage: 'Network timeout',
        },
      ]

      localStorageMock['moonshine_metrics'] = JSON.stringify(metrics)

      const result = viewMetrics()

      expect(result).toEqual(metrics)
      expect(consoleTableSpy).toHaveBeenCalled()
    })

    it('should not display metrics in production mode', async () => {
      vi.mocked(envUtils.isDev).mockReturnValue(false)

      const result = viewMetrics()

      expect(result).toBeUndefined()
      expect(consoleWarnSpy).toHaveBeenCalledWith('Metrics only available in dev mode')
      expect(consoleTableSpy).not.toHaveBeenCalled()
    })

    it('should handle corrupted localStorage data', async () => {
      localStorageMock['moonshine_metrics'] = 'invalid json'

      const result = viewMetrics()

      expect(result).toEqual([])
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to retrieve metrics:', expect.any(Error))
    })

    it('should handle missing optional fields', async () => {
      const metrics: ModelMetrics[] = [
        {
          modelName: 'model/tiny',
          loadTimeMs: 3000,
          cacheHit: false,
          // networkSpeedEstimate is optional
          transcriptLength: 42,
          timestamp: Date.now(),
          success: true,
        },
      ]

      localStorageMock['moonshine_metrics'] = JSON.stringify(metrics)

      const result = viewMetrics()

      expect(result).toEqual(metrics)
      expect(consoleTableSpy).toHaveBeenCalled()
    })
  })

  describe('clearMetrics', () => {
    it('should clear metrics from localStorage in dev mode', async () => {
      localStorageMock['moonshine_metrics'] = JSON.stringify([
        { modelName: 'model/tiny', loadTimeMs: 1000 },
      ])

      clearMetrics()

      expect(localStorage.removeItem).toHaveBeenCalledWith('moonshine_metrics')
      expect(localStorageMock['moonshine_metrics']).toBeUndefined()
      expect(consoleLogSpy).toHaveBeenCalledWith('✓ Metrics cleared')
    })

    it('should not clear metrics in production mode', async () => {
      vi.mocked(envUtils.isDev).mockReturnValue(false)

      clearMetrics()

      expect(localStorage.removeItem).not.toHaveBeenCalled()
      expect(consoleWarnSpy).toHaveBeenCalledWith('Metrics only available in dev mode')
    })
  })

  describe('getNetworkSpeedEstimate', () => {
    it('should return network speed from navigator.connection', async () => {
      const mockConnection = { downlink: 50.5 }
      vi.stubGlobal('navigator', {
        connection: mockConnection,
      })

      const result = getNetworkSpeedEstimate()

      expect(result).toBe(50.5)
    })

    it('should return network speed from navigator.mozConnection', async () => {
      const mockConnection = { downlink: 25.3 }
      vi.stubGlobal('navigator', {
        mozConnection: mockConnection,
      })

      const result = getNetworkSpeedEstimate()

      expect(result).toBe(25.3)
    })

    it('should return network speed from navigator.webkitConnection', async () => {
      const mockConnection = { downlink: 100 }
      vi.stubGlobal('navigator', {
        webkitConnection: mockConnection,
      })

      const result = getNetworkSpeedEstimate()

      expect(result).toBe(100)
    })

    it('should return undefined when connection API is not available', async () => {
      vi.stubGlobal('navigator', {})

      const result = getNetworkSpeedEstimate()

      expect(result).toBeUndefined()
    })

    it('should return undefined when downlink is not available', async () => {
      const mockConnection = { effectiveType: '4g' }
      vi.stubGlobal('navigator', {
        connection: mockConnection,
      })

      const result = getNetworkSpeedEstimate()

      expect(result).toBeUndefined()
    })

    it('should handle zero downlink speed', async () => {
      const mockConnection = { downlink: 0 }
      vi.stubGlobal('navigator', {
        connection: mockConnection,
      })

      const result = getNetworkSpeedEstimate()

      expect(result).toBe(0)
    })
  })

  describe('edge cases', () => {
    it('should handle very large transcript lengths', async () => {
      const metrics: ModelMetrics = {
        modelName: 'model/base',
        loadTimeMs: 5000,
        cacheHit: true,
        transcriptLength: 999999,
        timestamp: Date.now(),
        success: true,
      }

      trackModelPerformance(metrics)

      const stored = JSON.parse(localStorageMock['moonshine_metrics'])
      expect(stored[0].transcriptLength).toBe(999999)
    })

    it('should handle metrics with very old timestamps', async () => {
      const metrics: ModelMetrics = {
        modelName: 'model/tiny',
        loadTimeMs: 1000,
        cacheHit: true,
        transcriptLength: 10,
        timestamp: 0, // Unix epoch
        success: true,
      }

      localStorageMock['moonshine_metrics'] = JSON.stringify([metrics])

      const result = viewMetrics()

      expect(result).toEqual([metrics])
      expect(consoleTableSpy).toHaveBeenCalled()
    })

    it('should handle extremely slow load times', async () => {
      const metrics: ModelMetrics = {
        modelName: 'model/base',
        loadTimeMs: 300000, // 5 minutes
        cacheHit: false,
        transcriptLength: 10,
        timestamp: Date.now(),
        success: true,
      }

      trackModelPerformance(metrics)

      const stored = JSON.parse(localStorageMock['moonshine_metrics'])
      expect(stored[0].loadTimeMs).toBe(300000)
    })
  })
})
