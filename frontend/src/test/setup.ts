import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Cleanup DOM after each test to prevent test pollution
afterEach(() => {
  cleanup()
})

// Mock fetch globally for API tests
vi.stubGlobal('fetch', vi.fn())
