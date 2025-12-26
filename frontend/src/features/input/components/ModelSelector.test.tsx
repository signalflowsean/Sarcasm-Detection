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
    vi.stubEnv('DEV', false)
    vi.stubEnv('PROD', true)

    const { container } = render(<ModelSelector />)
    expect(container.firstChild).toBeNull()
  })

  it('should render in development mode', () => {
    // Mock development mode
    vi.stubEnv('MODE', 'development')
    vi.stubEnv('DEV', true)
    vi.stubEnv('PROD', false)
    vi.stubEnv('VITE_MOONSHINE_MODEL', 'model/base')

    render(<ModelSelector />)

    expect(screen.getByText(/Dev: Model Override/i)).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('should show all available model options', () => {
    vi.stubEnv('MODE', 'development')
    vi.stubEnv('DEV', true)
    vi.stubEnv('VITE_MOONSHINE_MODEL', 'model/base')

    render(<ModelSelector />)

    const select = screen.getByRole('combobox') as HTMLSelectElement
    const options = Array.from(select.options).map(opt => opt.value)

    expect(options).toEqual(['model/tiny', 'model/base'])
  })

  it('should use env default when no localStorage override', () => {
    vi.stubEnv('MODE', 'development')
    vi.stubEnv('DEV', true)
    vi.stubEnv('VITE_MOONSHINE_MODEL', 'model/tiny')

    render(<ModelSelector />)

    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('model/tiny')
  })

  it('should use localStorage override over env default', () => {
    vi.stubEnv('MODE', 'development')
    vi.stubEnv('DEV', true)
    vi.stubEnv('VITE_MOONSHINE_MODEL', 'model/base')
    localStorage.setItem('moonshine_model_override', 'model/tiny')

    render(<ModelSelector />)

    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('model/tiny')
  })

  it('should fall back to model/base if env is not set', () => {
    vi.stubEnv('MODE', 'development')
    vi.stubEnv('DEV', true)
    // Don't set VITE_MOONSHINE_MODEL

    render(<ModelSelector />)

    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('model/base')
  })

  it('should show auto-reload message', () => {
    vi.stubEnv('MODE', 'development')
    vi.stubEnv('DEV', true)

    render(<ModelSelector />)

    expect(screen.getByText(/page will reload when model changes/i)).toBeInTheDocument()
  })

  it('should auto-reload page after model change', () => {
    vi.stubEnv('MODE', 'development')
    vi.stubEnv('DEV', true)
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

  it('should dismiss when dismiss button is clicked', () => {
    vi.stubEnv('MODE', 'development')
    vi.stubEnv('DEV', true)
    vi.stubEnv('VITE_MOONSHINE_MODEL', 'model/base')

    const { container } = render(<ModelSelector />)

    // Should be visible initially
    expect(screen.getByText(/Dev: Model Override/i)).toBeInTheDocument()

    // Find and click dismiss button
    const dismissButton = screen.getByTitle('Dismiss')
    fireEvent.click(dismissButton)

    // Should be hidden
    expect(container.firstChild).toBeNull()
    expect(localStorage.getItem('moonshine_model_selector_dismissed')).toBe('true')
  })

  it('should not render if dismissed in localStorage', () => {
    vi.stubEnv('MODE', 'development')
    vi.stubEnv('DEV', true)
    localStorage.setItem('moonshine_model_selector_dismissed', 'true')

    const { container } = render(<ModelSelector />)

    expect(container.firstChild).toBeNull()
  })

  it('should minimize when minimize button is clicked', () => {
    vi.stubEnv('MODE', 'development')
    vi.stubEnv('DEV', true)
    vi.stubEnv('VITE_MOONSHINE_MODEL', 'model/base')

    render(<ModelSelector />)

    // Should show full component initially
    expect(screen.getByText(/Dev: Model Override/i)).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()

    // Find and click minimize button
    const minimizeButton = screen.getByTitle('Minimize')
    fireEvent.click(minimizeButton)

    // Should show minimized version (just the icon button)
    expect(screen.queryByText(/Dev: Model Override/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.getByTitle('Expand Model Selector')).toBeInTheDocument()
    expect(localStorage.getItem('moonshine_model_selector_minimized')).toBe('true')
  })

  it('should expand when minimized button is clicked', () => {
    vi.stubEnv('MODE', 'development')
    vi.stubEnv('DEV', true)
    vi.stubEnv('VITE_MOONSHINE_MODEL', 'model/base')
    localStorage.setItem('moonshine_model_selector_minimized', 'true')

    render(<ModelSelector />)

    // Should show minimized version initially
    expect(screen.queryByText(/Dev: Model Override/i)).not.toBeInTheDocument()
    const expandButton = screen.getByTitle('Expand Model Selector')

    // Click to expand
    fireEvent.click(expandButton)

    // Should show full component
    expect(screen.getByText(/Dev: Model Override/i)).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(localStorage.getItem('moonshine_model_selector_minimized')).toBe('false')
  })

  it('should render minimized version if minimized in localStorage', () => {
    vi.stubEnv('MODE', 'development')
    vi.stubEnv('DEV', true)
    localStorage.setItem('moonshine_model_selector_minimized', 'true')

    render(<ModelSelector />)

    expect(screen.queryByText(/Dev: Model Override/i)).not.toBeInTheDocument()
    expect(screen.getByTitle('Expand Model Selector')).toBeInTheDocument()
  })
})
