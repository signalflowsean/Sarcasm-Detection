import React from 'react'

type SharedTextAreaProps = {
  value: string
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  shouldFlash?: boolean
  rows?: number
}

const SharedTextArea = React.forwardRef<HTMLTextAreaElement, SharedTextAreaProps>(
  ({ value, onChange, placeholder, disabled = false, className = '', shouldFlash = false, rows = 4 }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (!disabled && onChange) onChange(e.target.value)
    }
    return (
      <textarea
        ref={ref}
        className={`shared-textarea ${className} ${shouldFlash ? 'should-flash' : ''}`}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
      />
    )
  }
)

SharedTextArea.displayName = 'SharedTextArea'

export default SharedTextArea






