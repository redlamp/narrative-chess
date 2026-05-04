import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { GameClient } from "./GameClient";
import { JoinGameForm } from "./JoinGameForm";
import { WaitingForOpponent } from "./WaitingForOpponent";
import { GameStatusSchema, TerminationReasonSchema } from "@/lib/schemas/game";

const ParamsSchema = z.object({ gameId: z.string().uuid() });

const RowSchema = z.object({
  id: z.string().uuid(),
  white_id: z.string().uuid().nullable(),
  black_id: z.string().uuid().nullable(),
  current_fen: z.string(),
  ply: z.number().int().nonnegative(),
  status: GameStatusSchema,
  current_turn: z.enum(["w", "b"]),
  termination_reason: TerminationReasonSchema.nullable(),
  white_name: z.string().nullable(),
  black_name: z.string().nullable(),
});

export default async function GamePage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const resolvedParams = await params;
  const parsedParams = ParamsSchema.safeParse(resolvedParams);
  if (!parsedParams.success) notFound();
  const gameId = parsedParams.data.gameId;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/games/${gameId}`);

  const [{ data, error }, observerCountResult] = await Promise.all([
    supabase
      .from("games")
      .select(`
        id,
        white_id,
        black_id,
        current_fen,
        ply,
        status,
        current_turn,
        termination_reason,
        white_name:white_id ( display_name ),
        black_name:black_id ( display_name )
      `)
      .eq("id", gameId)
      .single(),
    supabase
      .from("game_observers")
      .select("*", { count: "exact", head: true })
      .eq("game_id", gameId),
  ]);

  if (error || !data) notFound();

  // Supabase JS embed selects come back as { display_name } | null;
  // normalize to flat strings before validating with Zod.
  type EmbedRow = typeof data & {
    white_name: { display_name: string } | null;
    black_name: { display_name: string } | null;
  };
  const embedded = data as EmbedRow;
  const flat = {
    ...data,
    white_name: embedded.white_name?.display_name ?? null,
    black_name: embedded.black_name?.display_name ?? null,
  };

  const row = RowSchema.parse(flat);

  const viewerIsWhite = row.white_id === user.id;
  const viewerIsBlack = row.black_id === user.id;
  const viewerIsParticipant = viewerIsWhite || viewerIsBlack;
  const emptySide: "white" | "black" | null =
    row.white_id === null ? "white" : row.black_id === null ? "black" : null;

  // Build absolute share URL for the waiting screen.
  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3000";
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const shareUrl = `${proto}://${host}/games/${gameId}`;

  if (row.status === "open" && viewerIsParticipant) {
    return <WaitingForOpponent gameId={gameId} shareUrl={shareUrl} />;
  }
  if (row.status === "open" && !viewerIsParticipant && emptySide) {
    return <JoinGameForm gameId={gameId} emptySide={emptySide} />;
  }

  // Participants OR observers (any other authenticated user with the URL)
  // both render <GameClient>. Observers pass myColor=null and the client
  // disables drag/click and shows an "Observing" status.
  return (
    <GameClient
      gameId={gameId}
      myColor={viewerIsWhite ? "w" : viewerIsBlack ? "b" : null}
      whiteName={row.white_name ?? "(unknown)"}
      blackName={row.black_name ?? "(unknown)"}
      initialFen={row.current_fen}
      initialPly={row.ply}
      initialStatus={row.status}
      initialTerminationReason={row.termination_reason}
      initialObserverCount={observerCountResult.count ?? 0}
      viewerUserId={user.id}
    />
  );
}
