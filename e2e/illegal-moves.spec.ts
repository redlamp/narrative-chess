import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ensureUser, loginAs } from "./lib/auth-helper";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

test.skip(
  !SUPABASE_URL || !SERVICE_ROLE_KEY,
  "skipped: env vars not set",
);

test("server action rejects illegal moves before reaching the RPC", async ({
  browser,
}) => {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const userA = await ensureUser("e2e-illegal@example.com", "test1234password!");

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

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await loginAs(ctx, "e2e-illegal@example.com", "test1234password!", BASE_URL);

  const response = await page.request.post(
    `${BASE_URL}/api/games/${gameId}/move`,
    { data: { gameId, uci: "e2e5", expectedPly: 0 } },
  );

  expect(response.status()).toBe(400);
  const body = (await response.json()) as { ok: boolean; code?: string };
  expect(body.ok).toBe(false);
  expect(body.code).toBe("illegal_move");

  await admin.from("games").delete().eq("id", gameId);
  await ctx.close();
});
