/**
 * Application version information
 *
 * Access in browser console:
 *   window.__APP_VERSION__    - Full version object
 *   window.__APP_VERSION__.version  - Just the version string
 *
 * Or type: version() in console for formatted output
 */

// Import version from package.json (Vite handles this at build time)
const VERSION = __APP_VERSION__
const BUILD_TIME = __BUILD_TIME__

export interface AppVersion {
  version: string
  buildTime: string
  environment: 'development' | 'production'
}

export const appVersion: AppVersion = {
  version: VERSION,
  buildTime: BUILD_TIME,
  environment: import.meta.env.DEV ? 'development' : 'production',
}

// Expose to window for console access
declare global {
  interface Window {
    __APP_VERSION__: AppVersion
    version: () => void
  }
}

window.__APP_VERSION__ = appVersion

// Helper function for pretty console output
window.version = () => {
  console.log(
    `%c🎭 Sarcasm Detector v${appVersion.version}%c\n` +
      `Environment: ${appVersion.environment}\n` +
      `Built: ${appVersion.buildTime}`,
    'font-size: 16px; font-weight: bold; color: #c41e3a;',
    'font-size: 12px; color: #666;'
  )
}

// Log version on startup (only in production to avoid noise in dev)
if (!import.meta.env.DEV) {
  console.log(`🎭 Sarcasm Detector v${appVersion.version} (${appVersion.environment})`)
}

export default appVersion
