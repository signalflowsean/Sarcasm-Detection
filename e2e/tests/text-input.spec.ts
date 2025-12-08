import { test, expect } from '@playwright/test'

// Use a desktop viewport to avoid the mobile modal behavior
// The app's mobile breakpoint is 1440px
test.use({ viewport: { width: 1500, height: 900 } })

test.describe('Text Input Mode', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to text mode (correct path is /text-input)
    await page.goto('/text-input')
  })

  test('should display text input area', async ({ page }) => {
    // Should have a textarea for text input
    const textarea = page.locator('textarea')
    await expect(textarea).toBeVisible()
  })

  test('should allow typing text', async ({ page }) => {
    const textarea = page.locator('textarea')

    await textarea.fill('This is a test message')

    await expect(textarea).toHaveValue('This is a test message')
  })

  test('should have submit functionality', async ({ page }) => {
    const textarea = page.locator('textarea')

    // Type some text
    await textarea.fill('Oh wow, this is just amazing.')

    // Look for a submit button - the app uses "Send to Detector"
    const submitButton = page.locator(
      'button:has-text("Send to Detector"), button:has-text("Analyze"), button:has-text("Detect")'
    )

    // The submit button should be visible when text is entered
    await expect(submitButton.first()).toBeVisible()
  })
})
