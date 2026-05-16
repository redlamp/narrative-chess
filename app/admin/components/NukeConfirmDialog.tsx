"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type NukeResult = {
  success?: string;
  error?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Button label that opened this dialog (for the title). */
  actionLabel: string;
  /** Exact string the user must type to enable the submit button. */
  requiredText: string;
  /** Body copy explaining what's about to happen. */
  description: string;
  /** Extra checkbox label (e.g. "I have a backup..."). Hidden if undefined. */
  requireCheckboxLabel?: string;
  /** Returns a string banner on success, or throws on error. */
  onConfirm: () => Promise<string>;
  /** Called after the action completes (success or failure). */
  onComplete?: (result: NukeResult) => void;
};

export function NukeConfirmDialog({
  open,
  onOpenChange,
  actionLabel,
  requiredText,
  description,
  requireCheckboxLabel,
  onConfirm,
  onComplete,
}: Props) {
  const [typed, setTyped] = useState("");
  const [checked, setChecked] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const matches = typed === requiredText;
  const checkboxOk = !requireCheckboxLabel || checked;
  const ready = matches && checkboxOk && !pending;

  const reset = () => {
    setTyped("");
    setChecked(false);
    setError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleConfirm = () => {
    setError(null);
    startTransition(async () => {
      try {
        const banner = await onConfirm();
        onComplete?.({ success: banner });
        handleOpenChange(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed";
        setError(message);
        onComplete?.({ error: message });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{actionLabel}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Label htmlFor="nuke-confirm-input" className="text-sm">
            Type{" "}
            <code className="font-mono text-oxblood">{requiredText}</code>{" "}
            to confirm
          </Label>
          <Input
            id="nuke-confirm-input"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={requiredText}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
          />

          {requireCheckboxLabel ? (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                className="mt-1"
              />
              <span>{requireCheckboxLabel}</span>
            </label>
          ) : null}

          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!ready}
            style={{ backgroundColor: "var(--oxblood)", color: "white" }}
          >
            {pending ? "Working..." : actionLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
