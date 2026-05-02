import { z } from "zod";

export const UciSchema = z
  .string()
  .regex(
    /^[a-h][1-8][a-h][1-8][qrbn]?$/,
    "uci must match a-h1-8a-h1-8 + optional promo",
  );

export const MoveInputSchema = z.object({
  gameId: z.string().uuid(),
  uci: UciSchema,
  expectedPly: z.number().int().nonnegative(),
});

export type MoveInput = z.infer<typeof MoveInputSchema>;

export const GameStatusSchema = z.enum([
  "open",
  "in_progress",
  "white_won",
  "black_won",
  "draw",
  "aborted",
]);

export type GameStatus = z.infer<typeof GameStatusSchema>;

export const MakeMoveResultSchema = z.object({
  game_id: z.string().uuid(),
  ply: z.number().int(),
  san: z.string(),
  uci: UciSchema,
  fen_after: z.string(),
  status: GameStatusSchema,
});

export type MakeMoveResult = z.infer<typeof MakeMoveResultSchema>;
