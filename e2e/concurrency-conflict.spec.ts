import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ensureUser } from "./lib/auth-helper";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

test.skip(
  !SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY,
  "skipped: env vars not set",
);

const ALICE = {
  email: "phase5-alice-cc@narrativechess.test",
  password: "phase5-pw-alice-cc",
};
const BOB = {
  email: "phase5-bob-cc@narrativechess.test",
  password: "phase5-pw-bob-cc",
};

test("two simultaneous makeMove calls at same expected_ply — one wins", async () => {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const aliceUser = await ensureUser(ALICE.email, ALICE.password);
  const bobUser = await ensureUser(BOB.email, BOB.password);

  // Create an in-progress game directly via the service role client.
  const { data: game, error: gameErr } = await admin
    .from("games")
    .insert({
      white_id: aliceUser.id,
      black_id: bobUser.id,
      status: "in_progress",
      current_fen:
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      current_turn: "w",
      ply: 0,
    })
    .select("id")
    .single();
  if (gameErr || !game) throw gameErr ?? new Error("game create failed");
  const gameId = game.id;

  // Sign in as Alice and build an authenticated client via Bearer header.
  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data: sess, error: signInErr } = await anon.auth.signInWithPassword({
    email: ALICE.email,
    password: ALICE.password,
  });
  if (signInErr || !sess.session)
    throw signInErr ?? new Error("sign-in failed");

  const aliceClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
    global: {
      headers: { Authorization: `Bearer ${sess.session.access_token}` },
    },
  });

  // Fire two different moves from Alice's client, both claiming p_expected_ply: 0.
  const [r1, r2] = await Promise.all([
    aliceClient.rpc("make_move", {
      p_game_id: gameId,
      p_uci: "e2e4",
      p_san: "e4",
      p_fen_after:
        "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
      p_expected_ply: 0,
      p_terminal_status: null,
    }),
    aliceClient.rpc("make_move", {
      p_game_id: gameId,
      p_uci: "d2d4",
      p_san: "d4",
      p_fen_after:
        "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1",
      p_expected_ply: 0,
      p_terminal_status: null,
    }),
  ]);

  const wins = [r1, r2].filter((r) => !r.error).length;
  const losses = [r1, r2]
    .filter((r) => r.error)
    .filter((r) => /concurrency_conflict/.test(r.error?.message ?? "")).length;

  expect(wins).toBe(1);
  expect(losses).toBe(1);

  await admin.from("games").delete().eq("id", gameId);
});
