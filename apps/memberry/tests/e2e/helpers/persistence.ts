/**
 * Persistence verification helpers for action-contract tests.
 *
 * Verifies data survives beyond React Query cache by navigating
 * to a fresh page or reloading.
 */

import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

/**
 * Reload the current page and verify text is still visible.
 * Catches cache-only success where data wasn't persisted to DB.
 */
export async function expectVisibleAfterReload(page: Page, text: string | RegExp, timeout = 10000) {
  await page.reload()
  await page.waitForLoadState('domcontentloaded')
  if (typeof text === 'string') {
    await expect(page.getByText(text).first()).toBeVisible({ timeout })
  } else {
    await expect(page.getByText(text).first()).toBeVisible({ timeout })
  }
}

/**
 * Navigate to a different page and verify text is visible there.
 * Catches same-page cache success without cross-surface persistence.
 */
export async function expectVisibleOnPage(page: Page, url: string, text: string | RegExp, timeout = 10000) {
  await page.goto(url)
  await page.waitForLoadState('domcontentloaded')
  if (typeof text === 'string') {
    await expect(page.getByText(text).first()).toBeVisible({ timeout })
  } else {
    await expect(page.getByText(text).first()).toBeVisible({ timeout })
  }
}
