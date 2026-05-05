import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const CRON_SECRET = process.env.CRON_SECRET ?? "";

const LAG_CREDIT_MS = 200;

type Candidate = {
  id: string;
  current_turn: "w" | "b";
  ply: number;
  turn_started_at: string | null;
  white_remaining_ms: number | null;
  black_remaining_ms: number | null;
  time_control_type: "live" | "correspondence" | null;
  time_per_move_seconds: number | null;
};

function isExpired(g: Candidate): boolean {
  if (!g.turn_started_at) return false;
  const activeRemaining =
    g.current_turn === "w" ? g.white_remaining_ms : g.black_remaining_ms;
  if (activeRemaining === null) return false;
  const elapsed = Math.max(
    0,
    Date.now() - new Date(g.turn_started_at).getTime() - LAG_CREDIT_MS,
  );
  return elapsed > activeRemaining;
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new NextResponse("Server misconfigured", { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: candidates, error } = await supabase
    .from("games")
    .select(
      "id, current_turn, ply, turn_started_at, white_remaining_ms, black_remaining_ms, time_control_type, time_per_move_seconds",
    )
    .eq("status", "in_progress")
    .not("time_control_type", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let ended = 0;
  const failures: Array<{ id: string; reason: string }> = [];

  for (const g of (candidates ?? []) as Candidate[]) {
    if (!isExpired(g)) continue;
    const { error: rpcError } = await supabase.rpc("end_timeout", {
      p_game_id: g.id,
    });
    if (rpcError) {
      failures.push({ id: g.id, reason: rpcError.message });
      continue;
    }
    ended++;
  }

  return NextResponse.json({
    ok: true,
    candidates: candidates?.length ?? 0,
    ended,
    failures,
  });
}
