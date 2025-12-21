import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { MEDIA_QUERIES } from '../../breakpoints'
import { useMediaQuery } from '../input/hooks'
import { PATH_TO_VALUE, VALUE_TO_PATH } from './constants'
import { useWhichInput } from './useWhichInput'

/**
 * Component that syncs the rotary switch position with the URL route
 * - When the route changes, it updates the rotary switch
 * - When the rotary switch changes, it updates the route
 * - On mobile/tablet, routing is disabled (single-page experience)
 */
export function RouteSync() {
  const location = useLocation()
  const navigate = useNavigate()
  const { value, setValue } = useWhichInput()
  const isInitialMount = useRef(true)
  const isTabletOrMobile = useMediaQuery(MEDIA_QUERIES.isMobileOrTablet)
  const hasRedirectedToRoot = useRef(false)
  // Track the last values to detect actual changes
  const lastPathRef = useRef(location.pathname)
  const lastValueRef = useRef(value)

  // On mobile/tablet, skip route sync - single page experience
  // Redirect any route (including /getting-started) back to root
  useEffect(() => {
    if (!isTabletOrMobile) {
      hasRedirectedToRoot.current = false
      return
    }
    // On mobile/tablet, always redirect to root (routing is disabled)
    if (location.pathname !== '/') {
      // Reset the flag when pathname changes so we can redirect again
      if (hasRedirectedToRoot.current && lastPathRef.current === location.pathname) {
        // Already redirected this path, skip
        return
      }
      hasRedirectedToRoot.current = true
      lastPathRef.current = location.pathname
      navigate('/', { replace: true })
    } else {
      // We're on root, reset the flag for next navigation
      hasRedirectedToRoot.current = false
    }
  }, [isTabletOrMobile, location.pathname, navigate])

  // Sync route -> rotary switch (when user navigates via URL/back button)
  // Skip on mobile/tablet
  useEffect(() => {
    if (isTabletOrMobile) return

    const targetValue = PATH_TO_VALUE[location.pathname]

    // Handle unhandled routes by redirecting to default path
    if (targetValue === undefined) {
      // Only redirect if we haven't just redirected to avoid loops
      if (lastPathRef.current !== location.pathname) {
        const defaultPath = VALUE_TO_PATH[value] || '/getting-started'
        lastPathRef.current = defaultPath
        navigate(defaultPath, { replace: true })
      }
      return
    }

    // Only update if the pathname actually changed (not just a re-render)
    if (lastPathRef.current !== location.pathname) {
      lastPathRef.current = location.pathname

      if (targetValue !== value) {
        lastValueRef.current = targetValue
        setValue(targetValue)
      }
    }
  }, [location.pathname, setValue, value, navigate, isTabletOrMobile])

  // Sync rotary switch -> route (when user turns the knob)
  // Skip on mobile/tablet
  useEffect(() => {
    if (isTabletOrMobile) return
    // Skip navigation on initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false
      lastValueRef.current = value
      // But still navigate if we're on root path
      if (location.pathname === '/') {
        const targetPath = VALUE_TO_PATH[value]
        if (targetPath) {
          lastPathRef.current = targetPath
          navigate(targetPath, { replace: true })
        }
      }
      return
    }

    // Only navigate if the value actually changed (not from route sync)
    if (lastValueRef.current !== value) {
      lastValueRef.current = value

      const targetPath = VALUE_TO_PATH[value]
      if (targetPath && location.pathname !== targetPath) {
        lastPathRef.current = targetPath
        navigate(targetPath)
      }
    }
  }, [value, navigate, location.pathname, isTabletOrMobile])

  return null
}
