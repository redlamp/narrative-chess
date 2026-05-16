/**
 * Display-name filter for signup. Two purposes:
 *
 * 1. Block the worst-of-the-worst slurs from rendering across the
 *    games list, the move-log "your turn" toast, and PGN exports.
 * 2. Reserve a handful of system-y names (admin, moderator, narrative
 *    chess) so a bad actor can't impersonate staff.
 *
 * Deliberately small + curated. A larger filter belongs in a dedicated
 * service if the beta scales past a friends-and-family cohort.
 */

const RESERVED = [
  "admin",
  "administrator",
  "moderator",
  "support",
  "system",
  "staff",
  "narrative chess",
  "narrativechess",
  "narrative-chess",
] as const;

/**
 * Short slur block-list. Kept inline so a future iteration can replace
 * it with a remote list or a third-party service without changing the
 * call shape. Each entry is matched as a normalised substring against
 * the normalised display name.
 */
const SLUR_FRAGMENTS: ReadonlyArray<string> = [
  "nigger",
  "niggers",
  "nigga",
  "faggot",
  "faggots",
  "tranny",
  "trannies",
  "retard",
  "retards",
  "kike",
  "kikes",
  "chink",
  "chinks",
  "spic",
  "spics",
  "gook",
  "gooks",
  "wetback",
  "wetbacks",
  "raghead",
  "ragheads",
];

// Note: generic vulgarities like "cunt", "fuck", etc. are deliberately
// out of scope - the goal is to block slurs that target groups, not to
// police every salty word. They also trigger the Scunthorpe problem
// (substring match on a town name) and aren't worth the false positives
// for a friends-and-family beta.

/**
 * Lowercase + collapse common leet substitutions + strip non-alphanum
 * + collapse whitespace. Designed to catch \"N1GG3R\", \"n!g.g.e.r\",
 * \"n   i   g   g   e   r\" without tripping on \"scunthorpe\" (word
 * boundaries preserved via the leading-space normalisation only when
 * matching the reserved list; slur match is substring on the collapsed
 * form, which is correct here — a substring slur means the name
 * contains the slur).
 */
function normalise(input: string): string {
  return input
    .toLowerCase()
    .replace(/[0]/g, "o")
    .replace(/[1!|]/g, "i")
    .replace(/[3]/g, "e")
    .replace(/[4@]/g, "a")
    .replace(/[5$]/g, "s")
    .replace(/[7]/g, "t")
    .replace(/[^a-z]+/g, "");
}

export type DisplayNameCheck =
  | { ok: true }
  | { ok: false; reason: "reserved" | "blocked" };

export function checkDisplayName(input: string): DisplayNameCheck {
  const normalised = normalise(input);
  if (normalised.length === 0) return { ok: false, reason: "blocked" };

  const reserved = input.trim().toLowerCase().replace(/\s+/g, " ");
  if (RESERVED.some((r) => reserved === r || reserved === r.replace(/\s|-/g, ""))) {
    return { ok: false, reason: "reserved" };
  }

  if (SLUR_FRAGMENTS.some((s) => normalised.includes(s))) {
    return { ok: false, reason: "blocked" };
  }

  return { ok: true };
}

export function displayNameErrorMessage(check: DisplayNameCheck): string | null {
  if (check.ok) return null;
  return check.reason === "reserved"
    ? "That display name is reserved. Please pick a different one."
    : "Please pick a different display name.";
}
