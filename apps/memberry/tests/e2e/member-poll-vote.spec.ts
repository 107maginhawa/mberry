// WF-102 — Poll Vote + Read-only Results
/**
 * Member poll vote flow:
 *   1. Navigate to /my/surveys
 *   2. If an Available poll exists, open it, select an option, submit
 *   3. Assert poll results (bar / percentage / vote count) are visible
 *   4. Reload and assert read-only "already voted" results view
 *
 * Guard: if no Available poll is found for the seed member, the voting
 * tests skip with a clear message. The page-load test always runs.
 *
 * Auth: member role via test-fixture programmatic-auth (SEED_MEMBER_EMAIL).
 */

import { test, expect } from './helpers/test-fixture'
import { captureAnyApiSuccess, captureRouteHydration } from './helpers/real-flow'

test.use({ authRole: 'member' })

test.describe('Poll: Member vote + read-only results', () => {
  // ── 1. Page always loads ─────────────────────────────────────────
  test('my/surveys page loads for member', async ({ page }) => {
    const respP = captureAnyApiSuccess(page)
    await page.goto('/my/surveys')
    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)
    await expect(page.getByRole('heading', { name: 'My Surveys' })).toBeVisible()
    await expect(page.getByText('Failed to load surveys')).not.toBeVisible()
  })

  // ── 2. Vote + see results ────────────────────────────────────────
  test('member can vote on an available poll and see results', async ({ page }) => {
    const respP = captureAnyApiSuccess(page)
    await page.goto('/my/surveys')
    await respP

    // Find Available section — it only renders when there are unvoted items.
    const availableSection = page.getByRole('heading', { name: /available/i })
    const hasAvailable = await availableSection.isVisible({ timeout: 8000 }).catch(() => false)

    if (!hasAvailable) {
      // No Available polls for the seed member — skip gracefully.
      test.skip(true, 'No Available polls for seed member — seed data has no open polls for this member. Create one via officer UI or seed script to exercise this flow.')
      return
    }

    // Find a Poll-type card in the Available section.
    // The card has a "Poll" type badge and links to /my/surveys/<id>.
    const pollLink = page.locator('a[href*="/my/surveys/"]').first()
    const hasPollLink = await pollLink.isVisible({ timeout: 5000 }).catch(() => false)

    if (!hasPollLink) {
      test.skip(true, 'Available section has no poll-type cards with links — no clickable poll found.')
      return
    }

    // Open the poll detail page.
    const surveyRespP = captureRouteHydration(page, /\/surveys\/[^/]+$/)
    await pollLink.click()
    const surveyResp = await surveyRespP
    expect(surveyResp?.status()).toBe(200)

    // Wait for SurveyFlow to mount — question text should be visible.
    await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 10000 })

    // Check if already voted (myResponseStatus === 'completed' → already-voted view).
    const alreadyVotedText = page.getByText("You've already voted — here are the results.")
    const isAlreadyVoted = await alreadyVotedText.isVisible({ timeout: 3000 }).catch(() => false)

    if (isAlreadyVoted) {
      // Seed member already voted — jump straight to read-only assertion.
      await assertReadOnlyResults(page)
      return
    }

    // ── Vote: select first available option ─────────────────────────
    // ChoiceQuestion renders options as buttons (role="radio" or clickable divs).
    // Try role=radio first, then fall back to button with option text.
    const firstOption = page
      .getByRole('radio')
      .first()
      .or(page.locator('[data-choice-option]').first())

    const hasOption = await firstOption.isVisible({ timeout: 8000 }).catch(() => false)
    if (!hasOption) {
      // Not a choice-type poll (e.g. yes/no or rating) — click the first interactive element.
      // For yes/no polls, there are two buttons.
      const yesBtn = page.getByRole('button', { name: /yes/i })
      const hasYes = await yesBtn.isVisible({ timeout: 3000 }).catch(() => false)
      if (hasYes) {
        await yesBtn.click()
      }
    } else {
      await firstOption.click()
    }

    // Record the label of the selected option for post-vote assertion.
    // The option text is adjacent to the radio or is the button text itself.
    const selectedLabel = await page
      .getByRole('radio', { checked: true })
      .locator('..')
      .locator('span, label, p')
      .first()
      .textContent()
      .catch(() => null)

    // ── Submit ──────────────────────────────────────────────────────
    // Submit is `disabled={!canAdvance || submitting}` — it enables only once
    // the selected answer has propagated into SurveyFlow state. The flake was
    // two-fold: (1) choice-question options had no `data-choice-option` hook, so
    // a multi-option poll selected nothing and submit never enabled (now fixed
    // in the component); (2) under CI parallelism the enable can lag past a tight
    // 5s window. Wait for the selection to register (enabled submit) generously.
    const submitBtn = page.getByRole('button', { name: /submit/i })
    await expect(submitBtn).toBeEnabled({ timeout: 15000 })

    const voteRespP = captureRouteHydration(page, /\/surveys\/[^/]+\/responses/, { method: 'POST' })
    await submitBtn.click()
    const voteResp = await voteRespP
    // POST must succeed (200 or 201).
    expect(voteResp?.status()).toBeLessThan(300)

    // ── Assert results visible after voting ─────────────────────────
    // SurveyFlow shows "Poll results" heading + PollResults bars on the completion screen.
    await expect(page.getByText('Poll results')).toBeVisible({ timeout: 10000 })

    // At least one percentage value must render (format: "N%").
    await expect(page.locator('text=/%/')).toBeVisible({ timeout: 5000 })

    // If we captured the selected label, assert it appears in the results.
    if (selectedLabel?.trim()) {
      await expect(page.getByText(selectedLabel.trim(), { exact: false })).toBeVisible()
    }
  })

  // ── 3. Reload shows read-only already-voted view ─────────────────
  test('reloading a voted poll shows read-only results (already voted)', async ({ page }) => {
    const respP = captureAnyApiSuccess(page)
    await page.goto('/my/surveys')
    await respP

    // Look for a completed poll card (surveyType === 'poll') — rendered
    // as a <Link> in the Completed section.
    const completedPollLink = page
      .locator('section')
      .filter({ hasText: /Completed/ })
      .locator('a[href*="/my/surveys/"]')
      .first()

    const hasCompletedPoll = await completedPollLink.isVisible({ timeout: 8000 }).catch(() => false)

    if (!hasCompletedPoll) {
      test.skip(true, 'No completed poll in seed data — run the vote test first or seed a completed poll response to exercise this read-only view.')
      return
    }

    const surveyRespP = captureRouteHydration(page, /\/surveys\/[^/]+$/)
    await completedPollLink.click()
    const surveyResp = await surveyRespP
    expect(surveyResp?.status()).toBe(200)

    await assertReadOnlyResults(page)
  })
})

// ── Shared assertion: read-only already-voted results view ───────────

async function assertReadOnlyResults(page: import('@playwright/test').Page) {
  // Already-voted short-circuit in SurveyFlow shows this sentinel text.
  await expect(
    page.getByText("You've already voted — here are the results."),
  ).toBeVisible({ timeout: 10000 })

  // PollResults renders one result bar per option: percentage text "N%".
  await expect(page.locator('text=/%/')).toBeVisible({ timeout: 5000 })

  // Voting form must NOT be present — member cannot re-vote.
  await expect(page.getByRole('button', { name: /submit/i })).not.toBeVisible()
}
