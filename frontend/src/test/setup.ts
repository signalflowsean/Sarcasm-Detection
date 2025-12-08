import '@testing-library/jest-dom'

// Mock fetch globally for API tests
vi.stubGlobal('fetch', vi.fn())
