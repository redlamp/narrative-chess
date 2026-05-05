"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreateGameInputSchema, type ColorChoice } from "@/lib/schemas/game";
import { presetById, type PresetId } from "@/lib/chess/time-controls";

// Note: createGame either throws (via redirect on success) or resolves
// with an error object. There is no { ok: true } branch by design — the
// success path is the redirect, which is a thrown navigation signal that
// Next.js intercepts before it reaches the caller.
export type CreateGameError = {
  ok: false;
  code: "validation" | "unauthenticated" | "unknown";
  message: string;
};

function resolveColor(choice: ColorChoice): "white" | "black" {
  if (choice === "white") return "white";
  if (choice === "black") return "black";
  return Math.random() < 0.5 ? "white" : "black";
}

export async function createGame(
  input: { myColor: ColorChoice; presetId: PresetId },
): Promise<CreateGameError | never> {
  let preset;
  try {
    preset = presetById(input.presetId);
  } catch {
    return { ok: false, code: "validation", message: "invalid preset" };
  }

  const parsed = CreateGameInputSchema.safeParse({
    myColor: input.myColor,
    timeControlType: preset.timeControlType ?? undefined,
    timeInitialSeconds: preset.timeInitialSeconds,
    timeIncrementSeconds: preset.timeIncrementSeconds,
    timePerMoveSeconds: preset.timePerMoveSeconds,
  });
  if (!parsed.success) {
    return {
      ok: false,
      code: "validation",
      message: parsed.error.issues[0]?.message ?? "invalid input",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, code: "unauthenticated", message: "not signed in" };
  }

  const resolved = resolveColor(parsed.data.myColor);

  const { data, error } = await supabase.rpc("create_game", {
    p_my_color: resolved,
    p_time_control_type: parsed.data.timeControlType ?? null,
    p_time_initial_seconds: parsed.data.timeInitialSeconds ?? null,
    p_time_increment_seconds: parsed.data.timeIncrementSeconds ?? 0,
    p_time_per_move_seconds: parsed.data.timePerMoveSeconds ?? null,
  });
  if (error) {
    return { ok: false, code: "unknown", message: error.message };
  }

  // RPC returns the new uuid as a scalar; supabase-js wraps it depending on version.
  const gameId = typeof data === "string" ? data : (data as { id?: string } | null)?.id;
  if (!gameId) {
    return { ok: false, code: "unknown", message: "no game id returned" };
  }

  redirect(`/games/${gameId}`);
}
