import { expect, test } from "@playwright/test";
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
  email: "movelist-alice@narrativechess.test",
  password: "movelist-pw-alice",
};
const BOB = {
  email: "movelist-bob@narrativechess.test",
  password: "movelist-pw-bob",
};

test("move-list stepper renders + scrubs + keyboard", async ({
  browser,
  baseURL,
}) => {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const aliceUser = await ensureUser(ALICE.email, ALICE.password);
  const bobUser = await ensureUser(BOB.email, BOB.password);

  // Seed an in-progress game with 3 moves so the panel has visible
  // rows on first paint.
  const inserted = await admin
    .from("games")
    .insert({
      white_id: aliceUser.id,
      black_id: bobUser.id,
      status: "in_progress",
      current_fen:
        "rnbqkb1r/pppppppp/5n2/8/3PP3/8/PPP2PPP/RNBQKBNR b KQkq - 0 2",
      current_turn: "b",
      ply: 3,
    })
    .select("id")
    .single();
  if (inserted.error) throw inserted.error;
  const gameId = inserted.data.id;

  await admin.from("game_moves").insert([
    {
      game_id: gameId,
      ply: 1,
      san: "e4",
      uci: "e2e4",
      fen_after:
        "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      played_by: aliceUser.id,
    },
    {
      game_id: gameId,
      ply: 2,
      san: "Nf6",
      uci: "g8f6",
      fen_after:
        "rnbqkb1r/pppppppp/5n2/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 2",
      played_by: bobUser.id,
    },
    {
      game_id: gameId,
      ply: 3,
      san: "d4",
      uci: "d2d4",
      fen_after:
        "rnbqkb1r/pppppppp/5n2/8/3PP3/8/PPP2PPP/RNBQKBNR b KQkq - 0 2",
      played_by: aliceUser.id,
    },
  ]);

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await loginAs(ctx, page, ALICE.email, ALICE.password, baseURL!);
  await page.goto(`${baseURL}/games/${gameId}`);

  // Move list panel renders
  const list = page.getByTestId("move-list");
  await expect(list).toBeVisible();
  await expect(list.locator(".move-cell")).toHaveCount(3);

  // Click ply 1 -> the cell becomes active (oxblood class applied)
  await list.locator("[data-ply='1']").click();
  await expect(list.locator("[data-ply='1']")).toHaveClass(/bg-oxblood/);

  // ArrowDown -> snap to live (latest ply 3 active)
  await page.keyboard.press("ArrowDown");
  await expect(list.locator("[data-ply='3']")).toHaveClass(/bg-oxblood/);

  // ArrowUp -> ply 0 (no cell exists for ply 0, so no cell is active)
  await page.keyboard.press("ArrowUp");
  await expect(list.locator(".move-cell.bg-oxblood")).toHaveCount(0);

  // ArrowRight from start -> ply 1 active
  await page.keyboard.press("ArrowRight");
  await expect(list.locator("[data-ply='1']")).toHaveClass(/bg-oxblood/);

  await ctx.close();
});

test("opponent move auto-snaps board back to live", async ({
  browser,
  baseURL,
}) => {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const aliceUser = await ensureUser(ALICE.email, ALICE.password);
  const bobUser = await ensureUser(BOB.email, BOB.password);

  const inserted = await admin
    .from("games")
    .insert({
      white_id: aliceUser.id,
      black_id: bobUser.id,
      status: "in_progress",
      current_fen:
        "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      current_turn: "b",
      ply: 1,
    })
    .select("id")
    .single();
  if (inserted.error) throw inserted.error;
  const gameId = inserted.data.id;
  await admin.from("game_moves").insert({
    game_id: gameId,
    ply: 1,
    san: "e4",
    uci: "e2e4",
    fen_after:
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
    played_by: aliceUser.id,
  });

  const aliceCtx = await browser.newContext();
  const alicePage = await aliceCtx.newPage();
  await loginAs(aliceCtx, alicePage, ALICE.email, ALICE.password, baseURL!);
  await alicePage.goto(`${baseURL}/games/${gameId}`);

  // Wait for the move list to render (component hydrated + keyboard listener
  // attached) before pressing keys.
  const list = alicePage.getByTestId("move-list");
  await expect(list).toBeVisible();
  await expect(list.locator("[data-ply='1']")).toHaveClass(/bg-oxblood/);

  // Alice scrubs to ply 0 (start of game, no cell active)
  await alicePage.keyboard.press("ArrowUp");
  await expect(
    alicePage.locator(".move-cell.bg-oxblood"),
  ).toHaveCount(0);

  // Bob's move arrives via service-role insert (simulates realtime)
  await admin.from("game_moves").insert({
    game_id: gameId,
    ply: 2,
    san: "c5",
    uci: "c7c5",
    fen_after:
      "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
    played_by: bobUser.id,
  });
  await admin
    .from("games")
    .update({
      current_fen:
        "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
      current_turn: "w",
      ply: 2,
    })
    .eq("id", gameId);

  // Auto-snap: ply 2 should now be active (latest)
  await expect(
    alicePage.locator(".move-cell[data-ply='2']"),
  ).toHaveClass(/bg-oxblood/, { timeout: 10000 });

  await aliceCtx.close();
});
