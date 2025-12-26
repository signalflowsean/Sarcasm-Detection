import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import ExamplePhrases from './ExamplePhrases'

describe('ExamplePhrases', () => {
  it('should render all example phrases', () => {
    const mockOnSelect = vi.fn()
    render(<ExamplePhrases onSelect={mockOnSelect} />)

    expect(screen.getByTestId('example-phrases')).toBeInTheDocument()
    expect(screen.getByText(/Try a sarcastic example:/i)).toBeInTheDocument()
    expect(screen.getByText(/Or a sincere example:/i)).toBeInTheDocument()

    // Check sarcastic phrases
    expect(
      screen.getByText('Oh great, another meeting that could have been an email')
    ).toBeInTheDocument()
    expect(screen.getByText('I just love waking up at 5am on a Monday')).toBeInTheDocument()
    expect(screen.getByText('Sure, because that makes total sense')).toBeInTheDocument()

    // Check sincere phrases
    expect(screen.getByText('Thank you for your help with this project')).toBeInTheDocument()
    expect(screen.getByText('I really enjoyed the presentation today')).toBeInTheDocument()
    expect(screen.getByText('The weather is beautiful outside')).toBeInTheDocument()
  })

  it('should call onSelect when a sarcastic phrase is clicked', () => {
    const mockOnSelect = vi.fn()
    render(<ExamplePhrases onSelect={mockOnSelect} />)

    const phrase = 'Oh great, another meeting that could have been an email'
    const button = screen.getByText(phrase)
    fireEvent.click(button)

    expect(mockOnSelect).toHaveBeenCalledTimes(1)
    expect(mockOnSelect).toHaveBeenCalledWith(phrase)
  })

  it('should call onSelect when a sincere phrase is clicked', () => {
    const mockOnSelect = vi.fn()
    render(<ExamplePhrases onSelect={mockOnSelect} />)

    const phrase = 'Thank you for your help with this project'
    const button = screen.getByText(phrase)
    fireEvent.click(button)

    expect(mockOnSelect).toHaveBeenCalledTimes(1)
    expect(mockOnSelect).toHaveBeenCalledWith(phrase)
  })

  it('should call onSelect with correct phrase for each button', () => {
    const mockOnSelect = vi.fn()
    render(<ExamplePhrases onSelect={mockOnSelect} />)

    const phrases = [
      'Oh great, another meeting that could have been an email',
      'I just love waking up at 5am on a Monday',
      'Sure, because that makes total sense',
      'Thank you for your help with this project',
      'I really enjoyed the presentation today',
      'The weather is beautiful outside',
    ]

    phrases.forEach(phrase => {
      const button = screen.getByText(phrase)
      fireEvent.click(button)
    })

    expect(mockOnSelect).toHaveBeenCalledTimes(phrases.length)
    phrases.forEach(phrase => {
      expect(mockOnSelect).toHaveBeenCalledWith(phrase)
    })
  })

  it('should render buttons as disabled when disabled prop is true', () => {
    const mockOnSelect = vi.fn()
    render(<ExamplePhrases onSelect={mockOnSelect} disabled={true} />)

    const buttons = screen.getAllByRole('button')
    buttons.forEach(button => {
      expect(button).toBeDisabled()
    })
  })

  it('should render buttons as enabled when disabled prop is false', () => {
    const mockOnSelect = vi.fn()
    render(<ExamplePhrases onSelect={mockOnSelect} disabled={false} />)

    const buttons = screen.getAllByRole('button')
    buttons.forEach(button => {
      expect(button).not.toBeDisabled()
    })
  })

  it('should render buttons as enabled when disabled prop is not provided', () => {
    const mockOnSelect = vi.fn()
    render(<ExamplePhrases onSelect={mockOnSelect} />)

    const buttons = screen.getAllByRole('button')
    buttons.forEach(button => {
      expect(button).not.toBeDisabled()
    })
  })

  it('should not call onSelect when disabled button is clicked', () => {
    const mockOnSelect = vi.fn()
    render(<ExamplePhrases onSelect={mockOnSelect} disabled={true} />)

    const phrase = 'Oh great, another meeting that could have been an email'
    const button = screen.getByText(phrase)

    // Attempt to click disabled button
    fireEvent.click(button)

    // Disabled buttons don't fire click events, so onSelect should not be called
    expect(mockOnSelect).not.toHaveBeenCalled()
  })

  it('should render correct aria-label for each button', () => {
    const mockOnSelect = vi.fn()
    render(<ExamplePhrases onSelect={mockOnSelect} />)

    const phrases = [
      'Oh great, another meeting that could have been an email',
      'I just love waking up at 5am on a Monday',
      'Sure, because that makes total sense',
      'Thank you for your help with this project',
      'I really enjoyed the presentation today',
      'The weather is beautiful outside',
    ]

    phrases.forEach(phrase => {
      const button = screen.getByLabelText(`Use example: ${phrase}`)
      expect(button).toBeInTheDocument()
      expect(button).toHaveAttribute('aria-label', `Use example: ${phrase}`)
    })
  })

  it('should render all buttons with type="button"', () => {
    const mockOnSelect = vi.fn()
    render(<ExamplePhrases onSelect={mockOnSelect} />)

    const buttons = screen.getAllByRole('button')
    buttons.forEach(button => {
      expect(button).toHaveAttribute('type', 'button')
    })
  })

  it('should render all buttons with correct className', () => {
    const mockOnSelect = vi.fn()
    render(<ExamplePhrases onSelect={mockOnSelect} />)
    const buttons = screen.getAllByRole('button')
    buttons.forEach(button => {
      expect(button).toHaveClass('example-phrases__chip')
    })
  })
})
