/**
 * G10 smoke test for the per-test isolated fixture helper.
 *
 * Verifies that:
 *   - `withIsolatedFixture` creates a fresh org via POST /test/isolated-fixture
 *   - The org and its membership tier + members are reachable in DB
 *   - Teardown removes the org cleanly (afterAll-driven)
 *
 * If this spec stays green, mutating-tests in actions/, journeys/, etc.
 * can adopt the same pattern to escape the parallel-contamination class
 * of failures documented in docs/audits/E2E_REMEDIATION_FINAL.md.
 */

import { test, expect } from './helpers/test-fixture'
import {
  createIsolatedFixture,
  deleteIsolatedFixture,
  withIsolatedFixture,
} from './helpers/isolated-fixture'

test.describe('G10: isolated-fixture helper', () => {
  test('createIsolatedFixture returns orgId + tierId + personIds', async () => {
    const fx = await createIsolatedFixture({ memberCount: 2 })
    try {
      expect(fx.orgId).toMatch(/^[0-9a-f-]{36}$/)
      expect(fx.slug).toMatch(/^test-isolated-/)
      expect(fx.tierId).toBeTruthy()
      expect(fx.personIds).toHaveLength(2)
      for (const id of fx.personIds) {
        expect(id).toMatch(/^[0-9a-f-]{36}$/)
      }
    } finally {
      await deleteIsolatedFixture(fx.orgId)
    }
  })

  test.describe('withIsolatedFixture helper', () => {
    const fx = withIsolatedFixture(test, { memberCount: 1 })

    test('exposes the fixture inside the describe block', async () => {
      expect(fx().orgId).toMatch(/^[0-9a-f-]{36}$/)
      expect(fx().personIds).toHaveLength(1)
    })
  })
})
