import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ModelSelector } from './ModelSelector'

describe('ModelSelector', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    // Clear any mocked env vars
    vi.unstubAllEnvs()
    // Mock window.location.reload
    delete (window as Record<string, unknown>).location
    window.location = { reload: vi.fn() } as Location
    // Clear timers
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('should not render in production mode', () => {
    // Mock production mode
    vi.stubEnv('MODE', 'production')

    const { container } = render(<ModelSelector />)
    expect(container.firstChild).toBeNull()
  })

  it('should render in development mode', () => {
    // Mock development mode
    vi.stubEnv('MODE', 'development')
    vi.stubEnv('VITE_MOONSHINE_MODEL', 'model/base')

    render(<ModelSelector />)

    expect(screen.getByText(/Dev: Model Override/i)).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('should show all available model options', () => {
    vi.stubEnv('MODE', 'development')
    vi.stubEnv('VITE_MOONSHINE_MODEL', 'model/base')

    render(<ModelSelector />)

    const select = screen.getByRole('combobox') as HTMLSelectElement
    const options = Array.from(select.options).map(opt => opt.value)

    expect(options).toEqual(['model/tiny', 'model/base'])
  })

  it('should use env default when no localStorage override', () => {
    vi.stubEnv('MODE', 'development')
    vi.stubEnv('VITE_MOONSHINE_MODEL', 'model/tiny')

    render(<ModelSelector />)

    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('model/tiny')
  })

  it('should use localStorage override over env default', () => {
    vi.stubEnv('MODE', 'development')
    vi.stubEnv('VITE_MOONSHINE_MODEL', 'model/base')
    localStorage.setItem('moonshine_model_override', 'model/tiny')

    render(<ModelSelector />)

    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('model/tiny')
  })

  it('should fall back to model/base if env is not set', () => {
    vi.stubEnv('MODE', 'development')
    // Don't set VITE_MOONSHINE_MODEL

    render(<ModelSelector />)

    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('model/base')
  })

  it('should show auto-reload message', () => {
    vi.stubEnv('MODE', 'development')

    render(<ModelSelector />)

    expect(screen.getByText(/page will reload when model changes/i)).toBeInTheDocument()
  })

  it('should auto-reload page after model change', () => {
    vi.stubEnv('MODE', 'development')
    vi.stubEnv('VITE_MOONSHINE_MODEL', 'model/base')

    render(<ModelSelector />)

    const select = screen.getByRole('combobox') as HTMLSelectElement

    // Change model
    fireEvent.change(select, { target: { value: 'model/tiny' } })

    // Should update localStorage immediately
    expect(localStorage.getItem('moonshine_model_override')).toBe('model/tiny')

    // Should NOT have reloaded yet (300ms delay)
    expect(window.location.reload).not.toHaveBeenCalled()

    // Fast-forward timers
    vi.advanceTimersByTime(300)

    // Now it should have reloaded
    expect(window.location.reload).toHaveBeenCalledTimes(1)
  })
})
