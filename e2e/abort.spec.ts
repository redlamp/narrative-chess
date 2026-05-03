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
  email: "phase6-alice-abort@narrativechess.test",
  password: "phase6-pw-alice-abort",
};
const BOB = {
  email: "phase6-bob-abort@narrativechess.test",
  password: "phase6-pw-bob-abort",
};

async function userClient(email: string, password: string) {
  const c = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}

test("abort at ply=0 — status flips to aborted + termination_reason=abort", async () => {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const aliceUser = await ensureUser(ALICE.email, ALICE.password);
  const bobUser = await ensureUser(BOB.email, BOB.password);

  const { data: created } = await admin
    .from("games")
    .insert({
      white_id: aliceUser.id,
      black_id: bobUser.id,
      status: "in_progress",
      current_fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      current_turn: "w",
      ply: 0,
    })
    .select("id")
    .single();
  const gameId = created!.id;

  const aliceClient = await userClient(ALICE.email, ALICE.password);
  const { error: abortErr } = await aliceClient.rpc("abort_game", { p_game_id: gameId });
  expect(abortErr).toBeNull();

  const { data: g } = await admin
    .from("games")
    .select("status, termination_reason, ended_at")
    .eq("id", gameId)
    .single();
  expect(g!.status).toBe("aborted");
  expect(g!.termination_reason).toBe("abort");
  expect(g!.ended_at).not.toBeNull();

  await admin.from("games").delete().eq("id", gameId);
});

test("abort at ply=1 — RPC rejects with not_abortable", async () => {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const aliceUser = await ensureUser(ALICE.email, ALICE.password);
  const bobUser = await ensureUser(BOB.email, BOB.password);

  const { data: created } = await admin
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
  const gameId = created!.id;

  const aliceClient = await userClient(ALICE.email, ALICE.password);
  const { error } = await aliceClient.rpc("abort_game", { p_game_id: gameId });
  expect(error).not.toBeNull();
  expect(error!.message).toMatch(/not_abortable/);

  await admin.from("games").delete().eq("id", gameId);
});
