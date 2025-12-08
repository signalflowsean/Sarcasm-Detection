import '@testing-library/jest-dom'

// Mock fetch globally for API tests
global.fetch = vi.fn()

// Mock import.meta.env
vi.stubGlobal('import.meta', {
  env: {
    DEV: false,
    PROD: true,
    VITE_API_URL: 'http://localhost:5000',
  },
})

