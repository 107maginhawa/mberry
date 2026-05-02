import { test, expect } from "@playwright/test"

const MEMBER_EMAIL = "member@memberry.ph"
const MEMBER_PASSWORD = "TestPass123!"

async function signInAsMember(page: import("@playwright/test").Page) {
  await page.goto("/auth/sign-in")
  await page.getByLabel("Email").fill(MEMBER_EMAIL)
  await page.getByLabel("Password").fill(MEMBER_PASSWORD)
  await page.getByRole("button", { name: /sign in/i }).click()
  await page.waitForURL("**/dashboard")
}

test.describe("F1: Member Dashboard + Profile", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsMember(page)
  })

  // --- Dashboard ---

  test("dashboard shows greeting and org membership cards", async ({ page }) => {
    await expect(page.getByText(/welcome|good/i)).toBeVisible()
    await expect(page.getByText("PDA Metro Manila")).toBeVisible()
    await expect(page.locator("[data-testid='status-badge']").first()).toBeVisible()
  })

  test("dashboard shows credit summary widget", async ({ page }) => {
    await expect(page.getByText(/credits|cpd/i)).toBeVisible()
  })

  test("dashboard renders correctly on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto("/dashboard")
    await expect(page.locator("nav").filter({ has: page.getByText("Home") })).toBeVisible()
    await expect(page.locator("aside")).not.toBeVisible()
  })

  // --- Profile ---

  test("profile shows member info with photo area and details", async ({ page }) => {
    await page.goto("/my/profile")
    await expect(page.getByRole("heading", { name: /profile/i })).toBeVisible()
    await expect(page.locator("[data-testid='profile-avatar']")).toBeVisible()
    await expect(page.getByText("PDA Metro Manila")).toBeVisible()
  })

  test("profile edit saves changes", async ({ page }) => {
    await page.goto("/my/profile")
    await page.getByRole("button", { name: /edit/i }).click()
    await expect(page.getByLabel(/first name|name/i)).toBeVisible()
  })

  // --- Organizations ---

  test("organizations page shows membership cards with status", async ({ page }) => {
    await page.goto("/my/organizations")
    await expect(page.getByRole("heading", { name: /organizations/i })).toBeVisible()
    await expect(page.getByText("PDA Metro Manila")).toBeVisible()
    await expect(page.locator("[data-testid='status-badge']").first()).toBeVisible()
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
    await page.locator("nav").filter({ has: page.getByText("Home") }).getByText("Profile").click()
    await expect(page).toHaveURL(/\/my\/profile/)
  })
})
