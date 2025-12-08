import { test, expect } from '@playwright/test'

test.describe('Sarcasm Detector App', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/')

    // Should have the title (use first() since there are 2 h1 elements)
    await expect(page.locator('h1').first()).toContainText('Sarcasm Detector')
  })

  test('should redirect root to getting-started', async ({ page }) => {
    await page.goto('/')

    // Should redirect to getting-started route
    await expect(page).toHaveURL(/getting-started/)
  })

  test('should display the meter section', async ({ page }) => {
    await page.goto('/')

    // The meter section should be visible
    await expect(page.locator('main')).toBeVisible()
  })
})
