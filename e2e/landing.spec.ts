import { test, expect } from "@playwright/test";

test("/ renders auth header and Sign up dialog opens", async ({
  page,
  baseURL,
}) => {
  await page.goto(`${baseURL}/`);

  // Both auth buttons must be visible — role=button is unambiguous (SiteHeader
  // has nav links, not buttons named Sign in / Sign up).
  await expect(
    page.getByRole("button", { name: /^sign in$/i }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^sign up$/i }).first(),
  ).toBeVisible();

  // Click Sign up → modal opens.
  await page.getByRole("button", { name: /^sign up$/i }).first().click();

  // shadcn Dialog renders role="dialog"; fall back to alertdialog defensively.
  const dialog = page
    .getByRole("dialog")
    .or(page.getByRole("alertdialog"))
    .first();
  await expect(dialog).toBeVisible();

  // DialogTitle should read "Sign up". Use .first() — SignUpForm also renders
  // its own h1 "Sign up", so strict mode would otherwise reject the locator.
  await expect(
    page.getByRole("heading", { name: /^sign up$/i }).first(),
  ).toBeVisible();
});
