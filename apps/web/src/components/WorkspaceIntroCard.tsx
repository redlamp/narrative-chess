import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type WorkspaceNotice = {
  tone: "neutral" | "success" | "error";
  text: string;
};

type WorkspaceIntroCardProps = {
  badgeRow?: ReactNode;
  title: ReactNode;
  description: ReactNode;
  actions?: ReactNode;
  status?: WorkspaceNotice | null;
  children?: ReactNode;
  className?: string;
};

export function WorkspaceIntroCard({
  badgeRow,
  title,
  description,
  actions,
  status,
  children,
  className
}: WorkspaceIntroCardProps) {
  return (
    <Card className={cn("page-card page-card--intro workspace-intro-card", className)}>
      <CardHeader className="gap-4">
        {badgeRow ? <div className="flex flex-wrap items-center gap-2">{badgeRow}</div> : null}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="grid gap-2">
            <CardTitle className="text-3xl tracking-tight">{title}</CardTitle>
            <CardDescription className="max-w-4xl text-sm leading-6">{description}</CardDescription>
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {status ? (
          <div
            aria-live="polite"
            role="status"
            className={cn(
              "rounded-lg border p-3 text-sm",
              status.tone === "error"
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "bg-muted/30 text-muted-foreground"
            )}
          >
            {status.text}
          </div>
        ) : null}
        {children}
      </CardContent>
    </Card>
  );
}
