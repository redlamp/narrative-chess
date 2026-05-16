import { describe, expect, it } from "bun:test";
import { checkDisplayName } from "./display-name-filter";

describe("checkDisplayName", () => {
  it("accepts ordinary names", () => {
    expect(checkDisplayName("Taylor").ok).toBe(true);
    expect(checkDisplayName("anna-marie").ok).toBe(true);
    expect(checkDisplayName("白").ok).toBe(false); // non-ascii normalises to "" → blocked
    expect(checkDisplayName("MX Bones").ok).toBe(true);
  });

  it("rejects reserved staff names", () => {
    const res = checkDisplayName("admin");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("reserved");

    expect(checkDisplayName("Moderator").ok).toBe(false);
    expect(checkDisplayName("narrativechess").ok).toBe(false);
    expect(checkDisplayName("Narrative Chess").ok).toBe(false);
  });

  it("rejects obvious slurs", () => {
    const res = checkDisplayName("retard");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("blocked");
  });

  it("catches leet variants", () => {
    expect(checkDisplayName("R3T4RD").ok).toBe(false);
    expect(checkDisplayName("r.e.t.a.r.d").ok).toBe(false);
    expect(checkDisplayName("N!GG3R").ok).toBe(false);
  });

  it("does not trip on innocent substrings", () => {
    expect(checkDisplayName("scunthorpe").ok).toBe(true);
  });

  it("rejects empty / whitespace-only names", () => {
    expect(checkDisplayName("").ok).toBe(false);
    expect(checkDisplayName("   ").ok).toBe(false);
  });
});
