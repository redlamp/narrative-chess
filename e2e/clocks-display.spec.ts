import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ensureUser, loginAs } from "./lib/auth-helper";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const ALICE = { email: "clocks-alice@narrativechess.test", password: "clocks-pw-alice" };
const BOB = { email: "clocks-bob@narrativechess.test", password: "clocks-pw-bob" };

test("5+0 live clocks render + DB rows have time control state", async ({
  browser,
  baseURL,
}) => {
  await ensureUser(ALICE.email, ALICE.password);
  await ensureUser(BOB.email, BOB.password);

  const aliceCtx = await browser.newContext();
  const bobCtx = await browser.newContext();
  const alice = await aliceCtx.newPage();
  const bob = await bobCtx.newPage();

  await loginAs(aliceCtx, alice, ALICE.email, ALICE.password, baseURL!);
  await loginAs(bobCtx, bob, BOB.email, BOB.password, baseURL!);

  // Alice creates a 5+0 white-side game.
  await alice.goto(`${baseURL}/games/new`);
  await alice.locator("#color-white").check();
  await alice.locator("#tc-5min").check();
  await alice.getByRole("button", { name: /create game/i }).click();
  await alice.waitForURL(/\/games\/[0-9a-f-]{36}$/);
  const gameUrl = alice.url();
  const gameId = gameUrl.split("/").pop()!;

  // Bob sees the time-control label on join screen.
  await bob.goto(gameUrl);
  await expect(bob.getByText(/time control/i)).toBeVisible();
  await expect(bob.getByText(/5 min/i)).toBeVisible();

  // Bob joins.
  await bob.getByRole("button", { name: /join as black/i }).click();
  await expect(bob.locator("[data-testid='game-state']")).toHaveAttribute(
    "data-status",
    "in_progress",
    { timeout: 10_000 },
  );

  // Alice may need a refresh if Realtime didn't fire fast enough.
  try {
    await expect(alice.locator("[data-testid='game-state']")).toHaveAttribute(
      "data-status",
      "in_progress",
      { timeout: 3_000 },
    );
  } catch {
    await alice.goto(gameUrl);
  }

  // Both browsers render two clocks each (white + black). Use Locator.all to
  // be tolerant of mount order.
  const aliceClocks = await alice.getByTestId("clock").all();
  expect(aliceClocks.length).toBe(2);
  const bobClocks = await bob.getByTestId("clock").all();
  expect(bobClocks.length).toBe(2);

  // White clock should be active (it's white-to-move at ply 0).
  const aliceWhiteClock = alice.getByTestId("clock").locator("[data-side='white']");
  await expect(alice.locator("[data-testid='clock'][data-side='white']")).toHaveAttribute(
    "data-active",
    "true",
  );
  await expect(alice.locator("[data-testid='clock'][data-side='black']")).toHaveAttribute(
    "data-active",
    "false",
  );

  // Initial display is "5:00" or "4:5x" (interpolation may have ticked already).
  await expect(aliceWhiteClock).toContainText(/[045]:\d{2}/);

  // DB-level: row has correct time control + clock seed.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data: row } = await admin
    .from("games")
    .select(
      "time_control_type, time_initial_seconds, time_increment_seconds, time_per_move_seconds, white_remaining_ms, black_remaining_ms, turn_started_at",
    )
    .eq("id", gameId)
    .single();
  expect(row?.time_control_type).toBe("live");
  expect(row?.time_initial_seconds).toBe(300);
  expect(row?.time_increment_seconds).toBe(0);
  expect(row?.time_per_move_seconds).toBeNull();
  expect(row?.white_remaining_ms).toBe(300_000);
  expect(row?.black_remaining_ms).toBe(300_000);
  expect(row?.turn_started_at).not.toBeNull();

  await aliceCtx.close();
  await bobCtx.close();
});

test("untimed games still play (no clocks render, no math runs)", async ({
  browser,
  baseURL,
}) => {
  await ensureUser(ALICE.email, ALICE.password);
  await ensureUser(BOB.email, BOB.password);

  const aliceCtx = await browser.newContext();
  const bobCtx = await browser.newContext();
  const alice = await aliceCtx.newPage();
  const bob = await bobCtx.newPage();

  await loginAs(aliceCtx, alice, ALICE.email, ALICE.password, baseURL!);
  await loginAs(bobCtx, bob, BOB.email, BOB.password, baseURL!);

  await alice.goto(`${baseURL}/games/new`);
  await alice.locator("#color-white").check();
  await alice.locator("#tc-untimed").check();
  await alice.getByRole("button", { name: /create game/i }).click();
  await alice.waitForURL(/\/games\/[0-9a-f-]{36}$/);
  const gameUrl = alice.url();
  const gameId = gameUrl.split("/").pop()!;

  await bob.goto(gameUrl);
  await bob.getByRole("button", { name: /join as black/i }).click();
  await expect(bob.locator("[data-testid='game-state']")).toHaveAttribute(
    "data-status",
    "in_progress",
    { timeout: 10_000 },
  );

  // No clock UI should render.
  await expect(alice.getByTestId("clock")).toHaveCount(0);
  await expect(bob.getByTestId("clock")).toHaveCount(0);

  // DB-level: clock columns NULL.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data: row } = await admin
    .from("games")
    .select(
      "time_control_type, white_remaining_ms, black_remaining_ms, turn_started_at",
    )
    .eq("id", gameId)
    .single();
  expect(row?.time_control_type).toBeNull();
  expect(row?.white_remaining_ms).toBeNull();
  expect(row?.black_remaining_ms).toBeNull();
  // turn_started_at gets set on join even for untimed (cheap, harmless); accept either NULL or set.
  // (No assertion needed.)

  await aliceCtx.close();
  await bobCtx.close();
});
