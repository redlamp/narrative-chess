import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ensureUser } from "./lib/auth-helper";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

test.skip(
  !SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY,
  "skipped: env vars not set",
);

const ALICE = { email: "phase5-alice-jr@narrativechess.test", password: "phase5-pw-alice-jr" };
const BOB = { email: "phase5-bob-jr@narrativechess.test", password: "phase5-pw-bob-jr" };
const CAROL = { email: "phase5-carol-jr@narrativechess.test", password: "phase5-pw-carol-jr" };

function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

async function userClient(email: string, password: string) {
  const c = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}

test("two viewers click join simultaneously — one wins, one gets already_filled", async () => {
  await ensureUser(ALICE.email, ALICE.password);
  await ensureUser(BOB.email, BOB.password);
  await ensureUser(CAROL.email, CAROL.password);

  const aliceClient = await userClient(ALICE.email, ALICE.password);
  const { data: gameId, error: ce } = await aliceClient.rpc("create_game", { p_my_color: "white" });
  if (ce) throw ce;

  const bobClient = await userClient(BOB.email, BOB.password);
  const carolClient = await userClient(CAROL.email, CAROL.password);

  const [r1, r2] = await Promise.all([
    bobClient.rpc("join_open_game", { p_game_id: gameId }),
    carolClient.rpc("join_open_game", { p_game_id: gameId }),
  ]);

  const errs = [r1.error, r2.error].filter(Boolean);
  const oks = [r1.data, r2.data].filter((x) => x !== null && x !== undefined);

  expect(oks.length).toBe(1);
  expect(errs.length).toBe(1);
  // The RPC uses FOR UPDATE row-locking so concurrent joiners serialize.
  // The winner flips status to 'in_progress'; the loser hits the status check
  // first and raises 'not_open' (not 'already_filled', which would only fire
  // if both sides were already non-null before any lock was acquired).
  expect(errs[0]!.message).toMatch(/not_open|already_filled/);

  // Verify final state.
  const admin = adminClient();
  const { data: g } = await admin.from("games").select("status, white_id, black_id").eq("id", gameId).single();
  expect(g!.status).toBe("in_progress");
  expect(g!.black_id).not.toBeNull();
});
