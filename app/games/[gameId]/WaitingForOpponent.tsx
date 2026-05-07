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
    let sub: { unsubscribe: () => void } | null = null;
    let cancelled = false;
    void subscribeToGameStatus(gameId, (u) => {
      if (u.status === "in_progress") {
        toast.success("Opponent joined!");
        router.refresh();
      }
    }).then((s) => {
      if (cancelled) s.unsubscribe();
      else sub = s;
    });
    return () => {
      cancelled = true;
      sub?.unsubscribe();
    };
  }, [gameId, router]);

  const onCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <main className="container mx-auto max-w-xl py-16 px-6 space-y-6 text-center">
      <h1 className="font-display text-3xl tracking-tight text-foreground">
        Waiting for{" "}
        <em
          className="font-display italic"
          style={{ color: "var(--oxblood)" }}
        >
          opponent
        </em>
        …
      </h1>
      <p className="font-body italic text-sm text-ink-soft">
        Share this URL. The game starts as soon as someone joins.
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 rounded border border-rule-soft px-3 py-2 font-mono text-xs break-all bg-bg-soft">
          {shareUrl}
        </code>
        <Button type="button" onClick={onCopy} variant="outline">
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </main>
  );
}
