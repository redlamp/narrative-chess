"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createGame } from "./actions";
import type { ColorChoice } from "@/lib/schemas/game";

const CHOICES: { value: ColorChoice; label: string }[] = [
  { value: "white", label: "Play as white" },
  { value: "black", label: "Play as black" },
  { value: "random", label: "Random" },
];

export function NewGameForm() {
  const [choice, setChoice] = useState<ColorChoice>("random");
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await createGame({ myColor: choice });
      // createGame redirects on success, so we only land here on error.
      if (result && !result.ok) {
        toast.error(result.message);
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-md">
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Side</legend>
        {CHOICES.map((c) => (
          <div key={c.value} className="flex items-center gap-2">
            <input
              type="radio"
              id={`color-${c.value}`}
              name="myColor"
              value={c.value}
              checked={choice === c.value}
              onChange={() => setChoice(c.value)}
              disabled={pending}
            />
            <Label htmlFor={`color-${c.value}`}>{c.label}</Label>
          </div>
        ))}
      </fieldset>

      <Button type="submit" disabled={pending} size="lg">
        {pending ? "Creating…" : "Create game"}
      </Button>
    </form>
  );
}
