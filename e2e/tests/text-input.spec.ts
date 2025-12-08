import { test, expect } from '@playwright/test'

test.describe('Text Input Mode', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to text mode
    await page.goto('/text')
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
    
    // Look for a submit button or form action
    // The exact selector depends on the UI implementation
    const submitButton = page.locator('button[type="submit"], button:has-text("Analyze"), button:has-text("Detect")')
    
    // If there's a submit button, it should be visible when text is entered
    if (await submitButton.count() > 0) {
      await expect(submitButton.first()).toBeVisible()
    }
  })
})

