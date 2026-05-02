import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

// This spec runs against the live Supabase project. CI must have these env vars.
// For local dev, run with `bunx playwright test e2e/realtime-rls-gate.spec.ts`.

test.skip(
  !SUPABASE_URL || !SERVICE_ROLE_KEY,
  "skipped: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set",
);

test("participant sees Realtime event with row data; non-participant gets silence", async () => {
  // FIXME (Phase 4): replace with programmatic auth helper. The manual gate procedure
  // (wiki/notes/realtime-rls-gate-procedure.md) is the authoritative pass for Phase 3.
  // This scaffold exists so Phase 4+ can flip on the assertion when auth helpers land.
  test.fixme(
    true,
    "needs programmatic-login helper from Phase 4 to run unattended",
  );

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Use seeded test users when CI has them; otherwise skip.
  const { data: users } = await admin.auth.admin.listUsers();
  const userA = users.users.find((u) => u.email === "test1@example.com");
  const userB = users.users.find((u) => u.email === "test2@example.com");
  const userC = users.users.find((u) => u.email === "test3@example.com");

  test.skip(!userA || !userB || !userC, "test users not seeded");

  const { data: game } = await admin
    .from("games")
    .insert({
      white_id: userA!.id,
      black_id: userB!.id,
      status: "in_progress",
    })
    .select("id")
    .single();

  expect(game).toBeTruthy();

  // Phase 4 will fill in:
  //  1. Programmatic login as userA in browser context A, userC (non-participant) in context B
  //  2. Both navigate to /diagnostics/realtime, paste game_id, Subscribe
  //  3. Insert a game_moves row via admin client
  //  4. Assert context A's diagnostic UI receives event with `new` populated
  //  5. Assert context B's diagnostic UI shows zero events
  //  6. Cleanup created rows

  if (game) {
    await admin.from("games").delete().eq("id", game.id);
  }
});
