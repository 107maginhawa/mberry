import type { Page, BrowserContext } from '@playwright/test'

/**
 * Mock the system clock in the browser to a fixed date.
 * Uses page.addInitScript to override Date before any app code runs.
 *
 * Usage:
 *   await mockDate(page, new Date('2026-01-15T00:00:00Z'))
 *   // page now thinks it's Jan 15, 2026
 */
export async function mockDate(page: Page, fakeNow: Date): Promise<void> {
  const fakeTime = fakeNow.getTime()
  await page.addInitScript(`{
    const __REAL_DATE__ = Date;
    const __FAKE_NOW__ = ${fakeTime};
    const __OFFSET__ = __FAKE_NOW__ - __REAL_DATE__.now();

    class FakeDate extends __REAL_DATE__ {
      constructor(...args) {
        if (args.length === 0) {
          super(__REAL_DATE__.now() + __OFFSET__);
        } else {
          super(...args);
        }
      }
      static now() { return __REAL_DATE__.now() + __OFFSET__; }
    }
    // Preserve prototype chain
    FakeDate.prototype = __REAL_DATE__.prototype;
    window.Date = FakeDate;
  }`)
}

/**
 * Mock the clock for all pages in a browser context.
 * Must be called BEFORE navigating to any page.
 */
export async function mockDateForContext(context: BrowserContext, fakeNow: Date): Promise<void> {
  const fakeTime = fakeNow.getTime()
  await context.addInitScript(`{
    const __REAL_DATE__ = Date;
    const __FAKE_NOW__ = ${fakeTime};
    const __OFFSET__ = __FAKE_NOW__ - __REAL_DATE__.now();

    class FakeDate extends __REAL_DATE__ {
      constructor(...args) {
        if (args.length === 0) {
          super(__REAL_DATE__.now() + __OFFSET__);
        } else {
          super(...args);
        }
      }
      static now() { return __REAL_DATE__.now() + __OFFSET__; }
    }
    FakeDate.prototype = __REAL_DATE__.prototype;
    window.Date = FakeDate;
  }`)
}

/**
 * Advance the mocked clock by a duration (milliseconds).
 * Only works in the page's JS context — does NOT affect network requests.
 */
export async function advanceClock(page: Page, ms: number): Promise<void> {
  await page.evaluate((offset) => {
    // Access the injected offset variable and add to it
    (window as any).__CLOCK_EXTRA_OFFSET__ = ((window as any).__CLOCK_EXTRA_OFFSET__ ?? 0) + offset
  }, ms)
}

/**
 * Get the current "fake" time as seen by the page.
 */
export async function getPageTime(page: Page): Promise<Date> {
  const timestamp = await page.evaluate(() => Date.now())
  return new Date(timestamp)
}

/**
 * Create a date relative to now (or a base date) for test assertions.
 * Useful for "expires in 30 days" type checks.
 */
export function daysFromNow(days: number, base?: Date): Date {
  const start = base ?? new Date()
  return new Date(start.getTime() + days * 24 * 60 * 60 * 1000)
}

/**
 * Format date as YYYY-MM-DD for comparing with UI display.
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0] as string
}
