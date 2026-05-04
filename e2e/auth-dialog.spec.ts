import { expect, test } from "@playwright/test";
import { ensureUser } from "./lib/auth-helper";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

test.skip(
  !SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY,
  "skipped: env vars not set",
);

const USER = {
  email: "auth-dialog-user@narrativechess.test",
  password: "auth-dialog-pw",
};

test("AuthDialog sign-in closes dialog and lands on /games", async ({
  page,
  baseURL,
}) => {
  await ensureUser(USER.email, USER.password);

  await page.goto(`${baseURL}/`);

  // Open the Sign-in dialog from the auth header.
  await page.getByRole("button", { name: /^sign in$/i }).first().click();

  const dialog = page
    .getByRole("dialog")
    .or(page.getByRole("alertdialog"))
    .first();
  await expect(dialog).toBeVisible();

  // Fill the dialog form (the form inside the dialog scopes the inputs).
  await dialog.getByLabel(/email/i).fill(USER.email);
  await dialog.getByLabel(/password/i).fill(USER.password);
  await dialog.getByRole("button", { name: /log in/i }).click();

  // Dialog should close and the router should push /games.
  await page.waitForURL(`${baseURL}/games`, { timeout: 10_000 });
  await expect(dialog).not.toBeVisible();
});
