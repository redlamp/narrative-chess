import { cn } from "@/lib/utils";
import { getSquareTone } from "./cityMapShared";

type LocationBadgeProps = {
  name?: string | null;
  square?: string | null;
  ghost?: boolean;
  className?: string;
};

export function LocationBadge({ name, square, ghost = false, className }: LocationBadgeProps) {
  const blankValue = "\u00A0";
  const squareTone = square && !ghost ? getSquareTone(square) : null;

  return (
    <div className={cn("district-badge", className)}>
      <p className="district-badge__name">{name || blankValue}</p>
      {square ? (
        <span
          className={cn(
            "cities-page__district-square-pill",
            ghost
              ? "cities-page__district-square-pill--ghost"
              : squareTone
                ? `cities-page__district-square-pill--${squareTone}`
                : null
          )}
        >
          {square}
        </span>
      ) : null}
    </div>
  );
}
