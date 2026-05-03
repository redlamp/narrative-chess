"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { subscribeToGameStatus } from "@/lib/realtime/subscribe";

type Props = {
  gameId: string;
  shareUrl: string;
};

export function WaitingForOpponent({ gameId, shareUrl }: Props) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const sub = subscribeToGameStatus(gameId, (u) => {
      if (u.status === "in_progress") {
        toast.success("Opponent joined!");
        router.refresh();
      }
    });
    return () => sub.unsubscribe();
  }, [gameId, router]);

  const onCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <main className="container mx-auto max-w-xl py-16 px-6 space-y-6 text-center">
      <h1 className="text-2xl font-heading font-semibold">Waiting for opponent…</h1>
      <p className="text-sm text-muted-foreground">
        Share this URL. The game starts as soon as someone joins.
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 rounded border px-3 py-2 text-xs break-all bg-muted/40">
          {shareUrl}
        </code>
        <Button type="button" onClick={onCopy} variant="outline">
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </main>
  );
}
