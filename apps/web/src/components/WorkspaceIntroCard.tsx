import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FloatingActionNotice } from "./FloatingActionNotice";

type WorkspaceNotice = {
  tone: "neutral" | "success" | "error";
  text: string;
};

type WorkspaceIntroCardProps = {
  badgeRow?: ReactNode;
  title: ReactNode;
  actions?: ReactNode;
  status?: WorkspaceNotice | null;
  children?: ReactNode;
  className?: string;
};

export function WorkspaceIntroCard({
  badgeRow,
  title,
  actions,
  status,
  children,
  className
}: WorkspaceIntroCardProps) {
  return (
    <Card className={cn("page-card page-card--intro workspace-intro-card", className)}>
      <TooltipProvider delayDuration={150}>
        <CardHeader className="workspace-intro-card__header">
          <div className="workspace-intro-card__layout">
            <div className="workspace-intro-card__main">
              <div className="workspace-intro-card__title-row">
                <CardTitle className="workspace-intro-card__title">{title}</CardTitle>
                {badgeRow ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="workspace-intro-card__info-button"
                        aria-label="Show header details"
                      >
                        <Info />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="bottom"
                      align="start"
                      sideOffset={8}
                      className="workspace-intro-card__meta-tooltip"
                    >
                      <div className="workspace-intro-card__meta-tooltip-content">
                        {badgeRow}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ) : null}
              </div>
            </div>
            {actions ? (
              <div className="workspace-intro-card__actions-wrap">
                <div className="workspace-intro-card__actions">{actions}</div>
                <FloatingActionNotice notice={status ?? null} />
              </div>
            ) : null}
          </div>
        </CardHeader>
      </TooltipProvider>
      {children ? (
        <CardContent className="grid gap-3">
          {children}
        </CardContent>
      ) : null}
    </Card>
  );
}
