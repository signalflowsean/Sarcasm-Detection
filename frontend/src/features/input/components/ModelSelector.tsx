import { useState } from 'react'

/**
 * ModelSelector - Dev-mode only dropdown for testing different Moonshine models
 *
 * NOTE: This component IS dev-mode only - it's hidden in production builds.
 * It's visible only in development to allow manual testing and comparison
 * of different Moonshine models (tiny/base).
 *
 * The selected model persists to localStorage so developers can test consistently
 * across page reloads. The default value comes from VITE_MOONSHINE_MODEL env var.
 */
export function ModelSelector() {
  const envDefault = import.meta.env.VITE_MOONSHINE_MODEL || 'model/base'
  const [selectedModel, setSelectedModel] = useState(() => {
    // Check localStorage first, then env default
    return localStorage.getItem('moonshine_model_override') || envDefault
  })

  const [isDismissed, setIsDismissed] = useState(() => {
    return localStorage.getItem('moonshine_model_selector_dismissed') === 'true'
  })

  const [isMinimized, setIsMinimized] = useState(() => {
    return localStorage.getItem('moonshine_model_selector_minimized') === 'true'
  })

  const handleChange = (newModel: string) => {
    setSelectedModel(newModel)
    localStorage.setItem('moonshine_model_override', newModel)

    if (import.meta.env.MODE === 'development') {
      console.log(`Model changed to ${newModel}. Reloading...`)
    }

    // Small delay to ensure localStorage write completes and user sees the selection change
    setTimeout(() => {
      window.location.reload()
    }, 300)
  }

  const handleDismiss = () => {
    setIsDismissed(true)
    localStorage.setItem('moonshine_model_selector_dismissed', 'true')
  }

  const handleMinimize = () => {
    setIsMinimized(true)
    localStorage.setItem('moonshine_model_selector_minimized', 'true')
  }

  const handleExpand = () => {
    setIsMinimized(false)
    localStorage.setItem('moonshine_model_selector_minimized', 'false')
  }

  // Don't render in production (after hooks are called)
  if (import.meta.env.MODE !== 'development') {
    return null
  }

  // Don't render if dismissed
  if (isDismissed) {
    return null
  }

  // Render minimized version
  if (isMinimized) {
    return (
      <button
        onClick={handleExpand}
        style={{
          position: 'fixed',
          bottom: '1rem',
          left: '1rem',
          backgroundColor: '#ffeb3b',
          color: '#000',
          padding: '0.5rem',
          borderRadius: '0.5rem',
          border: '2px solid #fbc02d',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          zIndex: 9999,
          fontSize: '1rem',
          cursor: 'pointer',
          fontFamily: 'monospace',
          minWidth: '2.5rem',
          minHeight: '2.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title="Expand Model Selector"
      >
        🛠️
      </button>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1rem',
        left: '1rem',
        backgroundColor: '#ffeb3b',
        color: '#000',
        padding: '0.75rem',
        borderRadius: '0.5rem',
        border: '2px solid #fbc02d',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        zIndex: 9999,
        fontSize: '0.875rem',
        fontFamily: 'monospace',
      }}
    >
      <div
        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}
      >
        <label htmlFor="model-selector" style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>
          🛠️ Dev: Model Override
        </label>
        <div style={{ display: 'flex', gap: '0.25rem', marginLeft: 'auto' }}>
          <button
            onClick={handleMinimize}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid #fbc02d',
              borderRadius: '0.25rem',
              color: '#000',
              cursor: 'pointer',
              padding: '0.125rem 0.375rem',
              fontSize: '0.75rem',
              fontFamily: 'monospace',
              lineHeight: '1',
            }}
            title="Minimize"
          >
            −
          </button>
          <button
            onClick={handleDismiss}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid #fbc02d',
              borderRadius: '0.25rem',
              color: '#000',
              cursor: 'pointer',
              padding: '0.125rem 0.375rem',
              fontSize: '0.75rem',
              fontFamily: 'monospace',
              lineHeight: '1',
            }}
            title="Dismiss"
          >
            ×
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <select
          id="model-selector"
          value={selectedModel}
          onChange={e => handleChange(e.target.value)}
          style={{
            padding: '0.25rem 0.5rem',
            borderRadius: '0.25rem',
            border: '1px solid #fbc02d',
            backgroundColor: '#fff',
            color: '#000',
            fontSize: '0.875rem',
            fontFamily: 'monospace',
            cursor: 'pointer',
          }}
        >
          <option value="model/tiny">Tiny (190MB, faster)</option>
          <option value="model/base">Base (400MB, accurate)</option>
        </select>
      </div>
      <div
        style={{
          marginTop: '0.25rem',
          fontSize: '0.75rem',
          opacity: 0.8,
        }}
      >
        Page will reload when model changes
      </div>
    </div>
  )
}
