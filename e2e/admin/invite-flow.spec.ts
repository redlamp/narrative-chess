import { expect, test } from "@playwright/test";
import {
  ensureUser,
  promoteToAdmin,
  ensureInviteCode,
} from "../lib/auth-helper";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

test.skip(
  !SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY,
  "skipped: env vars not set",
);

const ADMIN = {
  email: "admin-invite-admin@narrativechess.test",
  password: "invite-pw-12345",
};

test.describe("invite code signup flow", () => {
  test("admin generates a code, fresh tester signs up with it, code marked consumed", async ({
    browser,
    baseURL,
  }) => {
    // Ensure admin exists + is admin.
    const admin = await ensureUser(ADMIN.email, ADMIN.password);
    if (!admin) throw new Error("admin user not created");
    await promoteToAdmin(admin.id);

    // Seed an invite code via service-role so the test doesn't depend on
    // driving the /admin form UI (covered in the role-gate spec).
    const code = await ensureInviteCode(admin.id, {
      note: "e2e invite-flow",
      expiresInDays: 1,
    });

    // Tester signs up via /sign-up form. Unique email per test run so the
    // ensureUser-style idempotency doesn't reuse a prior signup.
    const stamp = Date.now();
    const tester = {
      email: `admin-invite-tester-${stamp}@narrativechess.test`,
      password: "invite-pw-tester-12345",
      displayName: `tester ${stamp}`,
    };

    const testerContext = await browser.newContext();
    const testerPage = await testerContext.newPage();
    await testerPage.goto(`${baseURL}/sign-up`);
    await testerPage.fill('input[name="inviteCode"]', code);
    await testerPage.fill('input[name="displayName"]', tester.displayName);
    await testerPage.fill('input[name="email"]', tester.email);
    await testerPage.fill('input[name="password"]', tester.password);
    await testerPage.click('button[type="submit"]');

    // Successful signup -> /check-email (email confirmation enabled at
    // shipping; if it's currently off in Supabase the page still renders
    // for this redirect target).
    await testerPage.waitForURL(/\/check-email/, { timeout: 30_000 });

    // Verify the code is consumed in the DB.
    const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const { data: row } = await service
      .from("invite_codes")
      .select("code, consumed_by, consumed_at")
      .eq("code", code)
      .single();
    expect(row?.consumed_by).not.toBeNull();
    expect(row?.consumed_at).not.toBeNull();

    await testerContext.close();
  });

  test("invalid code at signup shows tester-facing error", async ({
    page,
    baseURL,
  }) => {
    const stamp = Date.now();
    await page.goto(`${baseURL}/sign-up`);
    await page.fill('input[name="inviteCode"]', "BADBADAD");
    await page.fill('input[name="displayName"]', `bad-${stamp}`);
    await page.fill(
      'input[name="email"]',
      `admin-invite-bad-${stamp}@narrativechess.test`,
    );
    await page.fill('input[name="password"]', "bad-pw-12345");
    await page.click('button[type="submit"]');

    // Error surface — either an alert role or the in-form text — should
    // include "not recognized" since this code was never inserted.
    const errorText = page.getByText(/not recognized|already used|expired/i);
    await expect(errorText).toBeVisible({ timeout: 10_000 });
  });
});
