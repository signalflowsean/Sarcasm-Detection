/**
 * Environment utilities for consistent environment checks across the app.
 *
 * Per Vite documentation, import.meta.env.DEV is the recommended way to check
 * for development mode. This utility provides a single source of truth.
 */

/**
 * Check if the app is running in development mode.
 *
 * @returns true if in development mode, false otherwise
 */
export function isDev(): boolean {
  return import.meta.env.DEV
}

/**
 * Check if the app is running in production mode.
 *
 * @returns true if in production mode, false otherwise
 */
export function isProd(): boolean {
  return import.meta.env.PROD
}
