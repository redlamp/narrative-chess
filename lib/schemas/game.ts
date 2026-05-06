import { z } from "zod";
import {
  GameStatusSchema,
  TerminationReasonSchema,
  type GameStatus,
  type TerminationReason,
} from "./move";

export { GameStatusSchema, TerminationReasonSchema };
export type { GameStatus, TerminationReason };

export const ColorChoiceSchema = z.enum(["white", "black", "random"]);
export type ColorChoice = z.infer<typeof ColorChoiceSchema>;

// M1.5++ — time control. NULL = untimed; live = Fischer (initial+increment);
// correspondence = per-move deadline.
export const TimeControlTypeSchema = z.enum(["live", "correspondence"]).nullable();
export type TimeControlType = z.infer<typeof TimeControlTypeSchema>;

export const CreateGameInputSchema = z
  .object({
    myColor: ColorChoiceSchema,
    timeControlType: TimeControlTypeSchema.optional(),
    timeInitialSeconds: z.number().int().positive().optional(),
    timeIncrementSeconds: z.number().int().nonnegative().optional(),
    timePerMoveSeconds: z.number().int().positive().optional(),
  })
  .refine(
    (v) => {
      if (!v.timeControlType) return true;
      if (v.timeControlType === "live") {
        return (
          v.timeInitialSeconds !== undefined &&
          v.timePerMoveSeconds === undefined
        );
      }
      if (v.timeControlType === "correspondence") {
        return (
          v.timePerMoveSeconds !== undefined &&
          v.timeInitialSeconds === undefined
        );
      }
      return true;
    },
    { message: "time control shape mismatch" },
  );
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

export const ResignInputSchema = z.object({
  gameId: z.string().uuid(),
});
export type ResignInput = z.infer<typeof ResignInputSchema>;

export const AbortInputSchema = z.object({
  gameId: z.string().uuid(),
});
export type AbortInput = z.infer<typeof AbortInputSchema>;

export const GameStatusUpdateEventSchema = z.object({
  id: z.guid(),
  status: GameStatusSchema,
  white_id: z.guid().nullable(),
  black_id: z.guid().nullable(),
  termination_reason: TerminationReasonSchema.nullable().optional(),
  // M1.5++ clock state — optional so old payloads still parse
  time_control_type: TimeControlTypeSchema.optional(),
  white_remaining_ms: z.number().int().nullable().optional(),
  black_remaining_ms: z.number().int().nullable().optional(),
  turn_started_at: z.string().nullable().optional(),
  current_turn: z.enum(["w", "b"]).optional(),
  ply: z.number().int().nonnegative().optional(),
});
export type GameStatusUpdateEvent = z.infer<typeof GameStatusUpdateEventSchema>;

export const RegisterObserverInputSchema = z.object({
  gameId: z.string().uuid(),
});
export type RegisterObserverInput = z.infer<typeof RegisterObserverInputSchema>;

// Presence-channel state we track per joined client.
export const ObserverPresenceEventSchema = z.object({
  joined_at: z.string(), // ISO timestamp
});
export type ObserverPresenceEvent = z.infer<typeof ObserverPresenceEventSchema>;
