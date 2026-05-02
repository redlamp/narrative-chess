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

test("concurrent makeMove with same expected_ply: one wins, one returns concurrency_conflict", async () => {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const userA = await ensureUser("e2e-conc-a@example.com", "test1234password!");
  const userB = await ensureUser("e2e-conc-b@example.com", "test1234password!");

  const { data: game, error: gameErr } = await admin
    .from("games")
    .insert({
      white_id: userA.id,
      black_id: userB.id,
      status: "in_progress",
    })
    .select("id")
    .single();
  if (gameErr || !game) throw gameErr ?? new Error("game create failed");
  const gameId = game.id;

  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data: sess, error: signInErr } = await anon.auth.signInWithPassword({
    email: "e2e-conc-a@example.com",
    password: "test1234password!",
  });
  if (signInErr || !sess.session) throw signInErr ?? new Error("sign-in failed");

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
    global: {
      headers: { Authorization: `Bearer ${sess.session.access_token}` },
    },
  });

  const args = {
    p_game_id: gameId,
    p_uci: "e2e4",
    p_san: "e4",
    p_fen_after:
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
    p_expected_ply: 0,
    p_terminal_status: null,
  };

  const [first, second] = await Promise.all([
    userClient.rpc("make_move", args),
    userClient.rpc("make_move", args),
  ]);

  const wins = [first, second].filter((r) => !r.error).length;
  const losses = [first, second]
    .filter((r) => r.error)
    .filter((r) => /concurrency_conflict/.test(r.error?.message ?? "")).length;

  expect(wins).toBe(1);
  expect(losses).toBe(1);

  await admin.from("games").delete().eq("id", gameId);
});
