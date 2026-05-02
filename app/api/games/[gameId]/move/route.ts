import { NextResponse } from "next/server";
import { makeMove } from "@/app/games/[gameId]/actions";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const result = await makeMove(body);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
