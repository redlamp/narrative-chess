import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ensureUser, loginAs } from "./lib/auth-helper";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

test.skip(
  !SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY,
  "skipped: env vars not set",
);

const ALICE = {
  email: "phase7-alice-dir@narrativechess.test",
  password: "phase7-pw-alice-dir",
};
const BOB = {
  email: "phase7-bob-dir@narrativechess.test",
  password: "phase7-pw-bob-dir",
};

test("games directory groups games by state", async ({ browser, baseURL }) => {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const aliceUser = await ensureUser(ALICE.email, ALICE.password);
  const bobUser = await ensureUser(BOB.email, BOB.password);

  // Insert one game per state for Alice.
  const startingFen =
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  const inserted = await admin
    .from("games")
    .insert([
      {
        white_id: aliceUser.id,
        black_id: bobUser.id,
        status: "in_progress",
        current_fen: startingFen,
        current_turn: "w",
        ply: 0,
      },
      {
        white_id: aliceUser.id,
        black_id: null,
        status: "open",
        current_fen: startingFen,
        current_turn: "w",
        ply: 0,
      },
      {
        white_id: aliceUser.id,
        black_id: bobUser.id,
        status: "white_won",
        termination_reason: "checkmate",
        current_fen: startingFen,
        current_turn: "b",
        ply: 4,
      },
    ])
    .select("id");
  if (inserted.error) throw inserted.error;
  const insertedIds = (inserted.data ?? []).map((r) => r.id);

  // Login Alice + visit /games.
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await loginAs(ctx, page, ALICE.email, ALICE.password, baseURL!);
  await page.goto(`${baseURL}/games`);

  await expect(
    page.getByRole("heading", { name: /your active games/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /your open challenges/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /your completed games/i }),
  ).toBeVisible();

  // Each section should have at least one row that's clickable.
  const links = page.locator("a[href^='/games/']");
  expect(await links.count()).toBeGreaterThanOrEqual(3);

  // Cleanup.
  await admin.from("games").delete().in("id", insertedIds);
  await ctx.close();
});
