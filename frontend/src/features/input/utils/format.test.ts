import { describe, it, expect } from 'vitest'
import { formatBytes } from './format'

describe('formatBytes', () => {
  describe('Bytes (B)', () => {
    it('formats 0 bytes', () => {
      expect(formatBytes(0)).toBe('0 B')
    })

    it('formats small byte values', () => {
      expect(formatBytes(1)).toBe('1 B')
      expect(formatBytes(512)).toBe('512 B')
      expect(formatBytes(1023)).toBe('1023 B')
    })
  })

  describe('Kilobytes (KB)', () => {
    it('formats exactly 1 KB', () => {
      expect(formatBytes(1024)).toBe('1.0 KB')
    })

    it('formats KB values under 10 with one decimal', () => {
      expect(formatBytes(2 * 1024)).toBe('2.0 KB')
      expect(formatBytes(5.5 * 1024)).toBe('5.5 KB')
      expect(formatBytes(9.9 * 1024)).toBe('9.9 KB')
    })

    it('formats KB values 10 and above as whole numbers', () => {
      expect(formatBytes(10 * 1024)).toBe('10 KB')
      expect(formatBytes(100 * 1024)).toBe('100 KB')
      expect(formatBytes(1023 * 1024)).toBe('1023 KB')
    })
  })

  describe('Megabytes (MB)', () => {
    it('formats exactly 1 MB', () => {
      expect(formatBytes(1024 * 1024)).toBe('1.0 MB')
    })

    it('formats MB values under 10 with one decimal', () => {
      expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.5 MB')
      expect(formatBytes(9.7 * 1024 * 1024)).toBe('9.7 MB')
    })

    it('formats MB values 10 and above as whole numbers', () => {
      expect(formatBytes(10 * 1024 * 1024)).toBe('10 MB')
      expect(formatBytes(150 * 1024 * 1024)).toBe('150 MB')
      expect(formatBytes(400 * 1024 * 1024)).toBe('400 MB')
      expect(formatBytes(1023 * 1024 * 1024)).toBe('1023 MB')
    })

    it('formats typical Moonshine model sizes', () => {
      // Tiny model: ~190 MB
      expect(formatBytes(190 * 1024 * 1024)).toBe('190 MB')
      // Base model: ~400 MB
      expect(formatBytes(400 * 1024 * 1024)).toBe('400 MB')
    })
  })

  describe('Gigabytes (GB)', () => {
    it('formats exactly 1 GB', () => {
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1.0 GB')
    })

    it('formats GB values under 10 with one decimal', () => {
      expect(formatBytes(1.5 * 1024 * 1024 * 1024)).toBe('1.5 GB')
      expect(formatBytes(5.25 * 1024 * 1024 * 1024)).toBe('5.3 GB')
      expect(formatBytes(9.8 * 1024 * 1024 * 1024)).toBe('9.8 GB')
    })

    it('formats GB values 10 and above as whole numbers', () => {
      expect(formatBytes(10 * 1024 * 1024 * 1024)).toBe('10 GB')
      expect(formatBytes(50 * 1024 * 1024 * 1024)).toBe('50 GB')
      expect(formatBytes(1023 * 1024 * 1024 * 1024)).toBe('1023 GB')
    })
  })

  describe('Terabytes (TB)', () => {
    it('formats exactly 1 TB', () => {
      expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe('1.0 TB')
    })

    it('formats TB values under 10 with one decimal', () => {
      expect(formatBytes(2.7 * 1024 * 1024 * 1024 * 1024)).toBe('2.7 TB')
      expect(formatBytes(9.5 * 1024 * 1024 * 1024 * 1024)).toBe('9.5 TB')
    })

    it('formats TB values 10 and above as whole numbers', () => {
      expect(formatBytes(10 * 1024 * 1024 * 1024 * 1024)).toBe('10 TB')
      expect(formatBytes(100 * 1024 * 1024 * 1024 * 1024)).toBe('100 TB')
    })

    it('does not overflow to PB (stays at TB for very large values)', () => {
      expect(formatBytes(5000 * 1024 * 1024 * 1024 * 1024)).toBe('5000 TB')
    })
  })

  describe('Edge cases', () => {
    it('handles negative numbers', () => {
      expect(formatBytes(-100)).toBe('0 B')
      expect(formatBytes(-1024)).toBe('0 B')
    })

    it('handles NaN', () => {
      expect(formatBytes(NaN)).toBe('0 B')
    })

    it('handles Infinity', () => {
      expect(formatBytes(Infinity)).toBe('0 B')
      expect(formatBytes(-Infinity)).toBe('0 B')
    })

    it('handles very small decimal values', () => {
      expect(formatBytes(0.5)).toBe('1 B') // Rounds to nearest byte
      expect(formatBytes(0.9)).toBe('1 B')
    })
  })

  describe('Precision and rounding', () => {
    it('rounds values appropriately when >= 10', () => {
      // 10.4 KB should round to 10
      expect(formatBytes(10.4 * 1024)).toBe('10 KB')
      // 10.6 KB should round to 11
      expect(formatBytes(10.6 * 1024)).toBe('11 KB')
    })

    it('shows one decimal place for values < 10', () => {
      // 5.567 KB should show as 5.6 KB
      expect(formatBytes(5.567 * 1024)).toBe('5.6 KB')
      // 9.432 MB should show as 9.4 MB
      expect(formatBytes(9.432 * 1024 * 1024)).toBe('9.4 MB')
    })
  })

  describe('Real-world scenarios', () => {
    it('formats typical web assets', () => {
      // Small image: 50 KB
      expect(formatBytes(50 * 1024)).toBe('50 KB')
      // Medium image: 2.3 MB
      expect(formatBytes(2.3 * 1024 * 1024)).toBe('2.3 MB')
      // Large video: 150 MB
      expect(formatBytes(150 * 1024 * 1024)).toBe('150 MB')
    })

    it('formats download progress values', () => {
      // Partial downloads
      expect(formatBytes(125829120)).toBe('120 MB') // 120 MB exactly
      expect(formatBytes(157286400)).toBe('150 MB') // 150 MB exactly
    })
  })
})
