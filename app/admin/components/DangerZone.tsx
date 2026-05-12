"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NukeConfirmDialog } from "./NukeConfirmDialog";
import { nukeAllGames, nukeAllBots, nukeAllNonAdminUsers } from "../actions";

type OpenKey = null | "games" | "bots" | "users";

export function DangerZone() {
  const router = useRouter();
  const [open, setOpen] = useState<OpenKey>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [bannerKind, setBannerKind] = useState<"success" | "error">("success");

  const setOpenFor = (key: OpenKey) => () => setOpen(key);
  const handleOpenChange = (next: boolean) => {
    if (!next) setOpen(null);
  };

  return (
    <section className="space-y-4">
      <h2 className="font-display text-2xl text-foreground">Danger zone</h2>

      {banner ? (
        <p
          className={`text-sm border rounded px-3 py-2 ${
            bannerKind === "success"
              ? "border-foreground/20 text-foreground"
              : "border-destructive/40 text-destructive"
          }`}
          role="status"
        >
          {banner}
        </p>
      ) : null}

      <div className="border-2 rounded p-4 space-y-3" style={{ borderColor: "var(--oxblood)" }}>
        <p className="text-sm text-muted-foreground">
          Destructive operations. Each action writes an audit row and cannot be
          undone. Bot cleanup is safest; the broad non-admin wipe is the final
          reset before opening the doors.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <DangerButton
            label="Delete all games"
            description="Wipes every game, move, and observer record. Users and invite codes preserved."
            onClick={setOpenFor("games")}
          />
          <DangerButton
            label="Delete all bot accounts"
            description="Targeted cleanup of e2e fixture accounts (role = bot). Real testers untouched."
            onClick={setOpenFor("bots")}
          />
          <DangerButton
            label="Delete all non-admin users"
            description="Broad reset: removes every player + bot account and their games. Admins safe."
            onClick={setOpenFor("users")}
          />
        </div>
      </div>

      <NukeConfirmDialog
        open={open === "games"}
        onOpenChange={handleOpenChange}
        actionLabel="Delete all games"
        requiredText="delete all games"
        description="This will permanently delete every game, every move, and every observer record. Users, invite codes, and audit history are preserved."
        onConfirm={async () => {
          const { count } = await nukeAllGames();
          return `Deleted ${count} game${count === 1 ? "" : "s"}.`;
        }}
        onComplete={(r) => handleComplete(r, router, setBanner, setBannerKind)}
      />

      <NukeConfirmDialog
        open={open === "bots"}
        onOpenChange={handleOpenChange}
        actionLabel="Delete all bot accounts"
        requiredText="delete all bot accounts"
        description="Removes every account tagged as bot (e2e fixtures, throwaways). Their games go with them. Real players and admins are untouched."
        onConfirm={async () => {
          const { count, failures } = await nukeAllBots();
          const note = failures.length
            ? ` ${failures.length} auth.users entries failed to delete (see audit log).`
            : "";
          return `Deleted ${count} bot account${count === 1 ? "" : "s"}.${note}`;
        }}
        onComplete={(r) => handleComplete(r, router, setBanner, setBannerKind)}
      />

      <NukeConfirmDialog
        open={open === "users"}
        onOpenChange={handleOpenChange}
        actionLabel="Delete all non-admin users"
        requiredText="delete all non-admin users"
        description="Permanently removes every account except admins. All their games disappear. Invite codes stay but with their consumed_by reference cleared. This is the final reset before opening to fresh testers."
        requireCheckboxLabel="I have a backup or I don't care about this data."
        onConfirm={async () => {
          const { count, failures } = await nukeAllNonAdminUsers();
          const note = failures.length
            ? ` ${failures.length} auth.users entries failed to delete (see audit log).`
            : "";
          return `Deleted ${count} non-admin user${count === 1 ? "" : "s"}.${note}`;
        }}
        onComplete={(r) => handleComplete(r, router, setBanner, setBannerKind)}
      />
    </section>
  );
}

function handleComplete(
  r: { success?: string; error?: string },
  router: ReturnType<typeof useRouter>,
  setBanner: (s: string | null) => void,
  setBannerKind: (k: "success" | "error") => void,
) {
  if (r.success) {
    setBanner(r.success);
    setBannerKind("success");
    router.refresh();
  } else if (r.error) {
    setBanner(r.error);
    setBannerKind("error");
  }
}

function DangerButton({
  label,
  description,
  onClick,
}: {
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left border border-rule rounded p-3 hover:border-oxblood hover:bg-oxblood/5 transition-colors"
    >
      <p className="font-display text-base text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
    </button>
  );
}
