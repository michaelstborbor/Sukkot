import { expect, test } from "@playwright/test";

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "SukkotDemo2026";

test("home page shows search and listings", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: /search/i }).first()).toBeVisible();
  await expect(page.locator("a[href^='/properties/']").first()).toBeVisible();
});

test("search filters by purpose and opens a listing with honest labels", async ({ page }) => {
  await page.goto("/properties?purpose=RENT");
  const first = page.locator("main a[href^='/properties/']").first();
  await expect(first).toBeVisible();
  await first.click();
  await expect(page).toHaveURL(/\/properties\/.+/);
  await expect(page.getByText(/Demonstration listing/i).first()).toBeVisible();
  await expect(page.getByText(/Illustrative image/i).first()).toBeVisible();
});

test("a tenant can sign in and reach the dashboard", async ({ page }) => {
  await page.goto("/auth/sign-in?next=/dashboard/messages");
  await page.getByLabel("Email").fill("tenant@demo.sukkot.sl");
  await page.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard\/messages/);
  await expect(page.getByRole("heading", { name: "Messages" })).toBeVisible();
});

test("protected pages redirect to sign in", async ({ page }) => {
  await page.goto("/dashboard/payments");
  await expect(page).toHaveURL(/\/auth\/sign-in/);
});

test("admin area is not available to tenants", async ({ page }) => {
  await page.goto("/auth/sign-in?next=/admin");
  await page.getByLabel("Email").fill("tenant@demo.sukkot.sl");
  await page.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/admin/);
});

test("pages fit the viewport without horizontal scrolling", async ({ page }) => {
  for (const path of ["/", "/properties", "/locations", "/help"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
});
