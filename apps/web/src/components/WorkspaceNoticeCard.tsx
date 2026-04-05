import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type WorkspaceNoticeCardProps = {
  tone: "neutral" | "success" | "error";
  title?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function WorkspaceNoticeCard({
  tone,
  title,
  children,
  className
}: WorkspaceNoticeCardProps) {
  return (
    <div
      className={cn(
        "workspace-notice-card",
        tone === "error"
          ? "workspace-notice-card--error"
          : tone === "success"
            ? "workspace-notice-card--success"
            : "workspace-notice-card--neutral",
        className
      )}
    >
      {title ? <p className="workspace-notice-card__title">{title}</p> : null}
      <div className="workspace-notice-card__body">{children}</div>
    </div>
  );
}
