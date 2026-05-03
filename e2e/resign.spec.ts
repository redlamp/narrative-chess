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
  email: "phase6-alice-resign@narrativechess.test",
  password: "phase6-pw-alice-resign",
};
const BOB = {
  email: "phase6-bob-resign@narrativechess.test",
  password: "phase6-pw-bob-resign",
};

test("resign flips status to opponent-color win + termination_reason=resignation", async () => {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const aliceUser = await ensureUser(ALICE.email, ALICE.password);
  const bobUser = await ensureUser(BOB.email, BOB.password);

  // Set up an in-progress game with at least one move so resign (not abort) applies.
  const { data: created, error: ce } = await admin
    .from("games")
    .insert({
      white_id: aliceUser.id,
      black_id: bobUser.id,
      status: "in_progress",
      current_fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
      current_turn: "b",
      ply: 1,
    })
    .select("id")
    .single();
  if (ce) throw ce;
  const gameId = created!.id;

  // Alice (white) resigns.
  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data: sess, error: signInErr } = await anon.auth.signInWithPassword({
    email: ALICE.email,
    password: ALICE.password,
  });
  if (signInErr || !sess.session) throw signInErr ?? new Error("sign-in failed");
  const aliceClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
    global: {
      headers: { Authorization: `Bearer ${sess.session.access_token}` },
    },
  });

  const { error: resignErr } = await aliceClient.rpc("resign", { p_game_id: gameId });
  expect(resignErr).toBeNull();

  // Verify final state.
  const { data: g } = await admin
    .from("games")
    .select("status, termination_reason, ended_at")
    .eq("id", gameId)
    .single();
  expect(g!.status).toBe("black_won");
  expect(g!.termination_reason).toBe("resignation");
  expect(g!.ended_at).not.toBeNull();

  // Cleanup.
  await admin.from("games").delete().eq("id", gameId);
});
