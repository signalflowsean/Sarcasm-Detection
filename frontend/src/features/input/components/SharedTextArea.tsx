import React from 'react'

type SharedTextAreaProps = {
  value: string
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  shouldFlash?: boolean
  rows?: number
  id?: string
  name?: string
  'aria-describedby'?: string
  'aria-label'?: string
}

const SharedTextArea = React.forwardRef<HTMLTextAreaElement, SharedTextAreaProps>(
  (
    {
      value,
      onChange,
      placeholder,
      disabled = false,
      className = '',
      shouldFlash = false,
      rows = 4,
      id = 'shared-textarea',
      name = 'shared-textarea',
      'aria-describedby': ariaDescribedBy,
      'aria-label': ariaLabel,
    },
    ref
  ) => {
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (!disabled && onChange) onChange(e.target.value)
    }
    return (
      <textarea
        ref={ref}
        id={id}
        name={name}
        className={`shared-textarea ${className} ${shouldFlash ? 'should-flash' : ''}`}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        aria-describedby={ariaDescribedBy}
        aria-label={ariaLabel}
        data-testid="textarea"
      />
    )
  }
)

SharedTextArea.displayName = 'SharedTextArea'

export default SharedTextArea
