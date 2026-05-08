import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  size?: "sm" | "md";
};

/**
 * Two-voice wordmark — italic Fraunces "Narrative" + boxed JetBrains Mono
 * "CHESS". Sets the entire app's typographic rule (humanist for narrative
 * voice, mono for technical voice) right at the front door.
 */
export function Wordmark({ className, size = "md" }: Props) {
  const narrSize = size === "sm" ? "text-[20px]" : "text-[28px]";
  const chessSize =
    size === "sm"
      ? "text-[10px] px-1.5 py-[3px]"
      : "text-[14px] px-1.5 py-1";

  return (
    <span className={cn("inline-flex items-baseline", className)}>
      <span
        className={cn(
          "font-display italic font-[380] tracking-tight",
          narrSize,
        )}
        style={{ fontVariationSettings: '"opsz" 144, "SOFT" 100, "WONK" 1' }}
      >
        Narrative
      </span>
      <span
        className={cn(
          "font-mono font-bold uppercase border-[1.5px] border-foreground self-center ml-2.5 leading-none",
          chessSize,
        )}
        style={{ letterSpacing: "0.06em" }}
      >
        CHESS
      </span>
    </span>
  );
}
