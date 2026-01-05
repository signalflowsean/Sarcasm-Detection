/**
 * Environment utilities for consistent environment checks across the app.
 *
 * Per Vite documentation, import.meta.env.DEV is the recommended way to check
 * for development mode. This utility provides a single source of truth.
 *
 * The environment values are cached at module load to avoid repeated lookups,
 * as they never change within a single execution context.
 */

// Cache environment checks at module level
// These values are determined at build time (Vite) or module load (runtime)
// and never change during the application lifecycle
const IS_DEV = import.meta.env.DEV
const IS_PROD = import.meta.env.PROD

/**
 * Check if the app is running in development mode.
 *
 * @returns true if in development mode, false otherwise
 */
export function isDev(): boolean {
  return IS_DEV
}

/**
 * Check if the app is running in production mode.
 *
 * @returns true if in production mode, false otherwise
 */
export function isProd(): boolean {
  return IS_PROD
}
