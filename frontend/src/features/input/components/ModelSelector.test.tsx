import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ModelSelector } from './ModelSelector'

vi.mock('../utils/env', () => ({
  isDev: vi.fn(() => true), // Default to dev mode, tests can override
  isProd: vi.fn(() => false),
}))

import * as envUtils from '../utils/env'

describe('ModelSelector', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    // Reset mocks
    vi.clearAllMocks()
    // Default to dev mode
    vi.mocked(envUtils.isDev).mockReturnValue(true)
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
    vi.mocked(envUtils.isDev).mockReturnValue(false)

    const { container } = render(<ModelSelector />)
    expect(container.firstChild).toBeNull()
  })

  it('should render in development mode', () => {
    // Already in dev mode by default

    render(<ModelSelector />)

    expect(screen.getByText(/Dev: Model Override/i)).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('should show all available model options', () => {
    render(<ModelSelector />)

    const select = screen.getByRole('combobox') as HTMLSelectElement
    const options = Array.from(select.options).map(opt => opt.value)

    expect(options).toEqual(['model/tiny', 'model/base'])
  })

  it('should use env default when no localStorage override', () => {
    // Note: ENV_DEFAULT_MODEL is module-scoped in ModelSelector.tsx and defaults to 'model/base'
    // We can't easily mock import.meta.env.VITE_MOONSHINE_MODEL, so this test verifies the fallback

    render(<ModelSelector />)

    const select = screen.getByRole('combobox') as HTMLSelectElement
    // The default is 'model/base' (hardcoded fallback in component)
    expect(select.value).toBe('model/base')
  })

  it('should use localStorage override over env default', () => {
    localStorage.setItem('moonshine_model_override', 'model/tiny')

    render(<ModelSelector />)

    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('model/tiny')
  })

  it('should fall back to model/base if env is not set', () => {
    // The component has a hardcoded fallback to 'model/base'

    render(<ModelSelector />)

    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('model/base')
  })

  it('should show auto-reload message', () => {
    render(<ModelSelector />)

    expect(screen.getByText(/page will reload when model changes/i)).toBeInTheDocument()
  })

  it('should auto-reload page after model change', () => {
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
    localStorage.setItem('moonshine_model_selector_dismissed', 'true')

    const { container } = render(<ModelSelector />)

    expect(container.firstChild).toBeNull()
  })

  it('should minimize when minimize button is clicked', () => {
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
    localStorage.setItem('moonshine_model_selector_minimized', 'true')

    render(<ModelSelector />)

    expect(screen.queryByText(/Dev: Model Override/i)).not.toBeInTheDocument()
    expect(screen.getByTitle('Expand Model Selector')).toBeInTheDocument()
  })
})
