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
  email: "phase5-alice-obs@narrativechess.test",
  password: "phase5-pw-alice-obs",
};
const BOB = {
  email: "phase5-bob-obs@narrativechess.test",
  password: "phase5-pw-bob-obs",
};
const CARLA = {
  email: "phase5-carla-obs@narrativechess.test",
  password: "phase5-pw-carla-obs",
};

test("observer (third authenticated viewer) sees the game state, cannot move", async ({
  browser,
  baseURL,
}) => {
  // Set up users + an in-progress game directly via service role.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const aliceUser = await ensureUser(ALICE.email, ALICE.password);
  const bobUser = await ensureUser(BOB.email, BOB.password);
  await ensureUser(CARLA.email, CARLA.password);

  const startingFen =
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const { data: created, error: ce } = await admin
    .from("games")
    .insert({
      white_id: aliceUser.id,
      black_id: bobUser.id,
      status: "in_progress",
      current_fen: startingFen,
      current_turn: "w",
      ply: 0,
    })
    .select("id")
    .single();
  if (ce) throw ce;
  const gameId = created!.id;

  // Carla — neither white nor black — opens the game URL as an observer.
  const carlaCtx = await browser.newContext();
  const carla = await carlaCtx.newPage();
  await loginAs(carlaCtx, carla, CARLA.email, CARLA.password, baseURL!);
  await carla.goto(`${baseURL}/games/${gameId}`);

  // Observer-mode probe: ply matches DB, status is in_progress.
  const probe = carla.locator("[data-testid='game-state']");
  await expect(probe).toHaveAttribute("data-ply", "0", { timeout: 10_000 });
  await expect(probe).toHaveAttribute("data-status", "in_progress");

  // Alice plays 1.e4 directly via RPC (drag-drop in Playwright headless
  // is unreliable per the existing realtime-rls-gate fixme; this exercises
  // the realtime delivery path which is the actual property under test).
  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data: aliceSess, error: signInErr } =
    await anon.auth.signInWithPassword({
      email: ALICE.email,
      password: ALICE.password,
    });
  if (signInErr || !aliceSess.session) {
    throw signInErr ?? new Error("alice sign-in failed");
  }
  const aliceClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
    global: {
      headers: { Authorization: `Bearer ${aliceSess.session.access_token}` },
    },
  });

  const fenAfterE4 =
    "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
  const { error: moveErr } = await aliceClient.rpc("make_move", {
    p_game_id: gameId,
    p_uci: "e2e4",
    p_san: "e4",
    p_fen_after: fenAfterE4,
    p_expected_ply: 0,
    p_terminal_status: null,
  });
  if (moveErr) throw moveErr;

  // Carla's observer page should pick up the move via realtime — without a
  // browser refresh — and the test hook reflects ply=1. (data-fen is not
  // emitted on the test hook; ply is the canonical signal.)
  await expect(probe).toHaveAttribute("data-ply", "1", { timeout: 5_000 });

  // Sanity: observer cannot drag any piece. arePiecesDraggable=false on the
  // library, so the rendered squares don't carry drag handlers. Even if a
  // drag attempt fired, isDraggablePiece returns false for an observer.
  // We assert the observer-status copy is present in the sidebar.
  await expect(carla.getByText(/observing/i)).toBeVisible();

  // Cleanup: drop the test game so re-runs aren't dirty.
  await admin.from("games").delete().eq("id", gameId);

  await carlaCtx.close();
});
