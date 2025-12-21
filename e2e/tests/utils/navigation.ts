import { expect, type Page } from '@playwright/test';
import { REDIRECT_TIMEOUT } from './constants';

/**
 * Navigates to a URL and expects it to redirect to root ('/').
 * Useful for testing mobile/tablet behavior where routing is disabled.
 *
 * @param page - Playwright page object
 * @param fromUrl - The URL to navigate from (will be redirected to '/')
 */
export async function expectRedirectToRoot(
  page: Page,
  fromUrl: string
): Promise<void> {
  await page.goto(fromUrl);
  // Should redirect to root (redirect should be instant, use shorter timeout)
  await page.waitForURL('/', { timeout: REDIRECT_TIMEOUT });
  await expect(page).toHaveURL('/');
}
