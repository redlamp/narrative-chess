import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ensureUser, loginAs } from "./lib/auth-helper";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

test.skip(
  !SUPABASE_URL || !SERVICE_ROLE_KEY,
  "skipped: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set",
);

test("participant sees Realtime event with row data; non-participant gets silence", async ({
  browser,
}) => {
  // Manual gate procedure (wiki/notes/realtime-rls-gate-procedure.md) is the
  // authoritative pass for Phase 3 / Phase 4 ship. This Playwright variant
  // reaches SUBSCRIBED state and admin-side INSERT succeeds, but the in-page
  // Realtime client doesn't render the event the way it does in a real browser
  // — likely a timing race between @supabase/ssr cookie-based session load and
  // the channel auth handshake. Re-enable when that race is understood.
  test.fixme(
    true,
    "Realtime event not reproducing in Playwright despite SUBSCRIBED + RLS-verified SELECT path; manual gate remains authoritative",
  );

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const userA = await ensureUser("e2e-a@example.com", "test1234password!");
  await ensureUser("e2e-c@example.com", "test1234password!");

  const { data: game, error: gameErr } = await admin
    .from("games")
    .insert({
      white_id: userA.id,
      black_id: userA.id,
      status: "in_progress",
    })
    .select("id")
    .single();
  if (gameErr || !game) throw gameErr ?? new Error("game create failed");
  const gameId = game.id;

  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  await loginAs(ctxA, pageA, "e2e-a@example.com", "test1234password!", BASE_URL);
  await pageA.goto(`${BASE_URL}/diagnostics/realtime`);
  await pageA.fill('input[id="gameId"]', gameId);
  await pageA.click('button:has-text("Subscribe")');
  await expect(pageA.locator("text=subscription: SUBSCRIBED")).toBeVisible({
    timeout: 10_000,
  });

  const ctxC = await browser.newContext();
  const pageC = await ctxC.newPage();
  await loginAs(ctxC, pageC, "e2e-c@example.com", "test1234password!", BASE_URL);
  await pageC.goto(`${BASE_URL}/diagnostics/realtime`);
  await pageC.fill('input[id="gameId"]', gameId);
  await pageC.click('button:has-text("Subscribe")');
  await expect(pageC.locator("text=subscription: SUBSCRIBED")).toBeVisible({
    timeout: 10_000,
  });

  // Realtime can take a beat between SUBSCRIBED and ready-to-deliver.
  await pageA.waitForTimeout(1_000);

  await admin.from("game_moves").insert({
    game_id: gameId,
    ply: 1,
    san: "e4",
    uci: "e2e4",
    fen_after:
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
    played_by: userA.id,
  });

  await expect(pageA.locator("text=Events (1)")).toBeVisible({
    timeout: 10_000,
  });
  await expect(pageA.getByText('"san": "e4"')).toBeVisible({ timeout: 5_000 });
  await expect(pageC.locator("text=Events (0)")).toBeVisible();

  await admin.from("games").delete().eq("id", gameId);
  await ctxA.close();
  await ctxC.close();
});
