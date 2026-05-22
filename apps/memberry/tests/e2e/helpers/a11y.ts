/**
 * Shared accessibility testing helper using axe-core.
 *
 * Usage:
 *   import { checkA11y, expectNoA11yViolations } from '../helpers/a11y'
 *   const violations = await checkA11y(page)
 *   await expectNoA11yViolations(page)
 */

import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

export interface A11yOptions {
  /** axe-core tags to include, e.g. ['wcag2a', 'wcag2aa'] */
  tags?: string[]
  /** CSS selectors to exclude from scanning */
  exclude?: string[]
  /** Rule IDs to disable (known issues) */
  disableRules?: string[]
}

const DEFAULT_TAGS = ['wcag2a', 'wcag2aa']

/**
 * Run axe accessibility scan and return violations array.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function checkA11y(page: Page, options?: A11yOptions): Promise<any[]> {
  let builder = new AxeBuilder({ page }).withTags(options?.tags ?? DEFAULT_TAGS)

  if (options?.exclude) {
    for (const selector of options.exclude) {
      builder = builder.exclude(selector)
    }
  }

  if (options?.disableRules) {
    builder = builder.disableRules(options.disableRules)
  }

  const results = await builder.analyze()
  return results.violations
}

/**
 * Assert no critical/serious a11y violations.
 * Warns on moderate/minor issues without failing the test.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function expectNoA11yViolations(page: Page, options?: A11yOptions): Promise<any[]> {
  const violations = await checkA11y(page, options)

  const critical = violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  )

  const minor = violations.filter(
    (v) => v.impact === 'moderate' || v.impact === 'minor',
  )

  if (minor.length > 0) {
    console.warn(
      `[a11y] ${minor.length} moderate/minor violations:`,
      minor.map((v) => `${v.id}: ${v.description} (${v.nodes.length} nodes)`),
    )
  }

  if (critical.length > 0) {
    const details = critical
      .map(
        (v) =>
          `\n  ${v.id} (${v.impact}): ${v.description}\n    ${v.helpUrl}\n    Affected: ${v.nodes.map((n: { target: string[] }) => n.target.join(' > ')).join(', ')}`,
      )
      .join('')

    throw new Error(`${critical.length} critical/serious a11y violations:${details}`)
  }

  return violations
}
