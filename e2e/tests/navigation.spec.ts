import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test('should navigate between modes', async ({ page }) => {
    await page.goto('/getting-started')
    
    // Verify we're on getting-started
    await expect(page).toHaveURL(/getting-started/)
    
    // Navigate to text mode via URL
    await page.goto('/text')
    await expect(page).toHaveURL(/text/)
    
    // Navigate to audio mode via URL
    await page.goto('/audio')
    await expect(page).toHaveURL(/audio/)
  })

  test('should handle invalid routes', async ({ page }) => {
    // Navigate to an invalid route
    await page.goto('/invalid-route-that-does-not-exist')
    
    // Should redirect to getting-started (based on App.tsx catch-all route)
    await expect(page).toHaveURL(/getting-started/)
  })

  test('should preserve URL state on refresh', async ({ page }) => {
    await page.goto('/text')
    
    // Reload the page
    await page.reload()
    
    // Should still be on text route
    await expect(page).toHaveURL(/text/)
  })
})

