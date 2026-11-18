import { expect, test } from "@playwright/test";
import { ensureUser, loginAs, promoteToAdmin } from "../lib/auth-helper";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

test.skip(
  !SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY,
  "skipped: env vars not set",
);

const PLAYER = {
  email: "admin-rolegate-player@narrativechess.test",
  password: "rolegate-pw-12345",
};

const ADMIN = {
  email: "admin-rolegate-admin@narrativechess.test",
  password: "rolegate-pw-12345",
};

test.describe("/admin role gate", () => {
  test("player role is redirected to /", async ({ page, baseURL, context }) => {
    // Create as player (override the bot default; we want this test user
    // to exercise the player-role redirect path specifically).
    await ensureUser(PLAYER.email, PLAYER.password, { role: "player" });
    await loginAs(context, page, PLAYER.email, PLAYER.password, baseURL!);

    await page.goto(`${baseURL}/admin`);
    // Middleware should rewrite to /. Wait for the URL to settle, then
    // confirm we're not on /admin.
    await page.waitForURL((u) => !u.pathname.startsWith("/admin"), {
      timeout: 10_000,
    });
    expect(new URL(page.url()).pathname).toBe("/");
  });

  test("admin role can load /admin and sees the four panels", async ({
    page,
    baseURL,
    context,
  }) => {
    const user = await ensureUser(ADMIN.email, ADMIN.password);
    if (!user) throw new Error("ensureUser returned no user");
    await promoteToAdmin(user.id);

    await loginAs(context, page, ADMIN.email, ADMIN.password, baseURL!);

    await page.goto(`${baseURL}/admin`);
    // Stays on /admin.
    await expect(page).toHaveURL(/\/admin/);
    // All four panel headings render.
    await expect(page.getByRole("heading", { name: /^Stats$/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Users$/ })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /^Invite codes$/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /^Danger zone$/ }),
    ).toBeVisible();
  });
});
