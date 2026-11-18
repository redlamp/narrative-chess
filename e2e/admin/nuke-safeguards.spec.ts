import { expect, test } from "@playwright/test";
import { ensureUser, loginAs, promoteToAdmin } from "../lib/auth-helper";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

test.skip(
  !SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY,
  "skipped: env vars not set",
);

const ADMIN = {
  email: "admin-nuke-safeguards@narrativechess.test",
  password: "nuke-pw-12345",
};

/**
 * NOTE: These tests verify the UI-level safeguards on the Danger Zone
 * confirmation dialogs. They do NOT actually invoke any nuke RPC — the
 * destructive RPCs are intentionally not exercised by Playwright because
 * they'd wipe shared state on the hosted Supabase project.
 *
 * Coverage:
 * - Typed-name guard keeps the submit button disabled until exact match
 * - Backup checkbox is required for the non-admin nuke variant
 * - Cancel closes the dialog without firing the action
 */

test.describe("/admin Danger Zone safeguards", () => {
  test.beforeEach(async ({ page, baseURL, context }) => {
    const admin = await ensureUser(ADMIN.email, ADMIN.password);
    if (!admin) throw new Error("admin user not created");
    await promoteToAdmin(admin.id);
    await loginAs(context, page, ADMIN.email, ADMIN.password, baseURL!);
    await page.goto(`${baseURL}/admin`);
  });

  test("typed-name guard blocks 'Delete all games' until exact match", async ({
    page,
  }) => {
    // Open the dialog by clicking the Danger-Zone button.
    await page
      .getByRole("button", { name: /Delete all games/ })
      .first()
      .click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const submitButton = dialog.getByRole("button", {
      name: /Delete all games/,
    });
    await expect(submitButton).toBeDisabled();

    // One character short — still disabled.
    await dialog.getByPlaceholder("delete all games").fill("delete all game");
    await expect(submitButton).toBeDisabled();

    // Wrong case (the guard is case-sensitive).
    await dialog
      .getByPlaceholder("delete all games")
      .fill("Delete all games");
    await expect(submitButton).toBeDisabled();

    // Exact match — enabled.
    await dialog.getByPlaceholder("delete all games").fill("delete all games");
    await expect(submitButton).toBeEnabled();

    // Cancel out rather than firing the nuke.
    await dialog.getByRole("button", { name: /Cancel/ }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("'Delete all non-admin users' requires both typed text + backup checkbox", async ({
    page,
  }) => {
    await page
      .getByRole("button", { name: /Delete all non-admin users/ })
      .first()
      .click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const submitButton = dialog.getByRole("button", {
      name: /Delete all non-admin users/,
    });
    await expect(submitButton).toBeDisabled();

    // Type the right text — still disabled because checkbox is unchecked.
    await dialog
      .getByPlaceholder("delete all non-admin users")
      .fill("delete all non-admin users");
    await expect(submitButton).toBeDisabled();

    // Check the backup checkbox — now enabled.
    await dialog.getByRole("checkbox").check();
    await expect(submitButton).toBeEnabled();

    // Uncheck the box — re-disabled.
    await dialog.getByRole("checkbox").uncheck();
    await expect(submitButton).toBeDisabled();

    await dialog.getByRole("button", { name: /Cancel/ }).click();
    await expect(dialog).not.toBeVisible();
  });
});
