import { z } from "zod";
import { GameStatusSchema, type GameStatus } from "./move";

export { GameStatusSchema };
export type { GameStatus };

export const ColorChoiceSchema = z.enum(["white", "black", "random"]);
export type ColorChoice = z.infer<typeof ColorChoiceSchema>;

export const CreateGameInputSchema = z.object({
  myColor: ColorChoiceSchema,
});
export type CreateGameInput = z.infer<typeof CreateGameInputSchema>;

export const JoinGameInputSchema = z.object({
  gameId: z.guid(),
});
export type JoinGameInput = z.infer<typeof JoinGameInputSchema>;

export const GameRowSchema = z.object({
  id: z.guid(),
  white_id: z.guid().nullable(),
  black_id: z.guid().nullable(),
  current_fen: z.string(),
  ply: z.number().int().nonnegative(),
  status: GameStatusSchema,
  current_turn: z.enum(["w", "b"]),
});
export type GameRow = z.infer<typeof GameRowSchema>;

export const MoveEventSchema = z.object({
  game_id: z.guid(),
  ply: z.number().int().nonnegative(),
  san: z.string().min(1),
  uci: z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/),
  fen_after: z.string(),
  played_by: z.guid(),
  played_at: z.string(),
});
export type MoveEvent = z.infer<typeof MoveEventSchema>;

export const GameStatusUpdateEventSchema = z.object({
  id: z.guid(),
  status: GameStatusSchema,
  white_id: z.guid().nullable(),
  black_id: z.guid().nullable(),
});
export type GameStatusUpdateEvent = z.infer<typeof GameStatusUpdateEventSchema>;
