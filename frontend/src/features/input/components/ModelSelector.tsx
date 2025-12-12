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

  // Don't render in production (after hooks are called)
  if (import.meta.env.MODE !== 'development') {
    return null
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <label htmlFor="model-selector" style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>
          🛠️ Dev: Model Override
        </label>
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
