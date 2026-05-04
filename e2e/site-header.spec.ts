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
  email: "header-nav-alice@narrativechess.test",
  password: "header-nav-pw-alice",
};
const BOB = {
  email: "header-nav-bob@narrativechess.test",
  password: "header-nav-pw-bob",
};

test("site header navigation across routes", async ({ browser, baseURL }) => {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const aliceUser = await ensureUser(ALICE.email, ALICE.password);
  const bobUser = await ensureUser(BOB.email, BOB.password);

  // Seed an in-progress game so /games/[id] is reachable.
  const startingFen =
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const inserted = await admin
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
  if (inserted.error) throw inserted.error;
  const gameId = inserted.data.id;

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await loginAs(ctx, page, ALICE.email, ALICE.password, baseURL!);

  // Header renders on /, brand link points home.
  await page.goto(`${baseURL}/`);
  const header = page.locator("header").first();
  await expect(header).toBeVisible();
  await expect(header.getByRole("link", { name: "Narrative Chess" })).toHaveAttribute(
    "href",
    "/",
  );

  // On /, "Home" link is active (aria-current=page).
  await expect(header.getByRole("link", { name: "Home" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(header.getByRole("link", { name: "Games" })).not.toHaveAttribute(
    "aria-current",
    "page",
  );
  // No current-game link off a game route.
  await expect(header.getByRole("link", { name: /current game/i })).toHaveCount(0);

  // Click Games — lands on /games, that link becomes active.
  await header.getByRole("link", { name: "Games" }).click();
  await page.waitForURL(`${baseURL}/games`);
  await expect(header.getByRole("link", { name: "Games" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(header.getByRole("link", { name: /current game/i })).toHaveCount(0);

  // Visit game route — Current game link appears + is active.
  await page.goto(`${baseURL}/games/${gameId}`);
  await expect(
    header.getByRole("link", { name: /current game/i }),
  ).toBeVisible();
  await expect(
    header.getByRole("link", { name: /current game/i }),
  ).toHaveAttribute("aria-current", "page");

  // Brand link still routes home.
  await header.getByRole("link", { name: "Narrative Chess" }).click();
  await page.waitForURL(`${baseURL}/`);

  // Cleanup.
  await admin.from("games").delete().eq("id", gameId);
  await ctx.close();
});
