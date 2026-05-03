import { describe, expect, test } from "bun:test";
import { ObserverPresenceEventSchema } from "@/lib/schemas/game";

// Pure-schema test only — joinObserverPresence requires a live Supabase
// connection and is exercised in the manual / e2e gate.

describe("ObserverPresenceEventSchema (used by observer-presence)", () => {
  test("accepts presence payloads", () => {
    expect(
      ObserverPresenceEventSchema.safeParse({
        joined_at: new Date().toISOString(),
      }).success,
    ).toBe(true);
  });
  test("rejects garbage", () => {
    expect(ObserverPresenceEventSchema.safeParse({}).success).toBe(false);
    expect(ObserverPresenceEventSchema.safeParse(null).success).toBe(false);
  });
});
