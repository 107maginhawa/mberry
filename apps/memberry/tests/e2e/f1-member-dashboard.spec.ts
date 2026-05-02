import { test, expect } from "@playwright/test"

const MEMBER_EMAIL = "member@memberry.ph"
const MEMBER_PASSWORD = "TestPass123!"

async function signInAsMember(page: import("@playwright/test").Page) {
  await page.goto("/auth/sign-in")
  await page.getByLabel("Email").fill(MEMBER_EMAIL)
  await page.getByLabel("Password").fill(MEMBER_PASSWORD)
  await page.getByRole("button", { name: /login|sign in/i }).click()
  await page.waitForURL("**/dashboard")
}

test.describe("F1: Member Dashboard + Profile", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsMember(page)
  })

  // --- Dashboard ---

  test("dashboard shows greeting and org membership cards", async ({ page }) => {
    // Greeting with member name
    await expect(page.getByText(/good (morning|afternoon|evening)/i)).toBeVisible()
    // Org section heading
    await expect(page.getByText("Your Organizations")).toBeVisible()
    // Status badge on membership card
    await expect(page.locator("[data-testid='status-badge']").first()).toBeVisible()
  })

  test("dashboard shows credit summary widget", async ({ page }) => {
    await expect(page.getByText("CPD Credits", { exact: true })).toBeVisible()
    await expect(page.getByText("Credit Progress")).toBeVisible()
  })

  test("dashboard renders correctly on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto("/dashboard")
    // Bottom nav visible (fixed at bottom, not inside aside)
    await expect(page.locator("nav.fixed")).toBeVisible()
    // Desktop sidebar hidden
    await expect(page.locator("aside")).not.toBeVisible()
  })

  // --- Profile ---

  test("profile shows member info with photo area and details", async ({ page }) => {
    await page.goto("/my/profile")
    await expect(page.getByRole("heading", { name: /profile/i })).toBeVisible()
    await expect(page.locator("[data-testid='profile-avatar']")).toBeVisible()
  })

  test("profile edit shows form", async ({ page }) => {
    await page.goto("/my/profile")
    await page.getByRole("button", { name: /edit/i }).click()
    // Edit form should appear with heading
    await expect(page.getByText("Edit Profile")).toBeVisible()
    // Should have input fields
    await expect(page.getByText("First Name")).toBeVisible()
  })

  // --- Organizations ---

  test("organizations page shows heading and content", async ({ page }) => {
    await page.goto("/my/organizations")
    await expect(page.getByRole("heading", { name: /organizations/i })).toBeVisible()
    // Either shows membership cards with status or empty state
    const hasBadge = await page.locator("[data-testid='status-badge']").first().isVisible().catch(() => false)
    const hasEmpty = await page.getByText(/no memberships/i).isVisible().catch(() => false)
    expect(hasBadge || hasEmpty).toBeTruthy()
  })

  // --- Settings ---

  test("settings shows tabbed sections", async ({ page }) => {
    await page.goto("/my/settings")
    await expect(page.getByRole("heading", { name: /settings/i })).toBeVisible()
    await expect(page.getByRole("tab", { name: /general|privacy|security|notifications/i }).first()).toBeVisible()
  })

  // --- Navigation ---

  test("sidebar navigation works on desktop", async ({ page }) => {
    await page.locator("aside").getByText("Profile").click()
    await expect(page).toHaveURL(/\/my\/profile/)
    await page.locator("aside").getByText("Home").click()
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test("bottom nav works on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto("/dashboard")
    await page.locator("nav.fixed").getByText("Profile").click()
    await expect(page).toHaveURL(/\/my\/profile/)
  })
})
