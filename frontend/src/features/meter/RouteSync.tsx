import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useWhichInput } from './useWhichInput'
import { VALUE_TO_PATH, PATH_TO_VALUE } from './constants'

/**
 * Component that syncs the rotary switch position with the URL route
 * - When the route changes, it updates the rotary switch
 * - When the rotary switch changes, it updates the route
 */
export function RouteSync() {
  const location = useLocation()
  const navigate = useNavigate()
  const { value, setValue } = useWhichInput()
  const isInitialMount = useRef(true)
  
  // Track the last values to detect actual changes
  const lastPathRef = useRef(location.pathname)
  const lastValueRef = useRef(value)

  // Sync route -> rotary switch (when user navigates via URL/back button)
  useEffect(() => {
    // Only update if the pathname actually changed (not just a re-render)
    if (lastPathRef.current !== location.pathname) {
      lastPathRef.current = location.pathname
      
      const targetValue = PATH_TO_VALUE[location.pathname]
      
      // Handle unhandled routes by redirecting to default path
      if (targetValue === undefined) {
        const defaultPath = VALUE_TO_PATH[value] || '/getting-started'
        lastPathRef.current = defaultPath
        navigate(defaultPath, { replace: true })
        return
      }
      
      if (targetValue !== value) {
        lastValueRef.current = targetValue
        setValue(targetValue)
      }
    }
  }, [location.pathname, setValue, value, navigate])

  // Sync rotary switch -> route (when user turns the knob)
  useEffect(() => {
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
  }, [value, navigate, location.pathname])

  return null
}