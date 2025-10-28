import React from 'react'

export const PowerIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path d="M12 3v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M6.88 6.88a7 7 0 1 0 9.9 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)

export const MicIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <rect x="9" y="3" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="2"/>
    <path d="M5 11a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M12 19v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)

export const KeyboardIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="2"/>
    <g fill="currentColor">
      <rect x="5" y="8" width="2" height="2" rx="0.5"/>
      <rect x="8" y="8" width="2" height="2" rx="0.5"/>
      <rect x="11" y="8" width="2" height="2" rx="0.5"/>
      <rect x="14" y="8" width="2" height="2" rx="0.5"/>
      <rect x="17" y="8" width="2" height="2" rx="0.5"/>
      <rect x="6" y="11" width="2" height="2" rx="0.5"/>
      <rect x="9" y="11" width="2" height="2" rx="0.5"/>
      <rect x="12" y="11" width="2" height="2" rx="0.5"/>
      <rect x="15" y="11" width="2" height="2" rx="0.5"/>
    </g>
    <rect x="7" y="14" width="10" height="2" rx="1" fill="currentColor"/>
  </svg>
)

export const DefaultIcon: React.FC<{ value: string }> = ({ value }) => {
  if (value === 'off') return <PowerIcon />
  if (value === 'audio') return <MicIcon />
  if (value === 'text') return <KeyboardIcon />
  return <span aria-hidden>{value.slice(0, 1).toUpperCase()}</span>
}