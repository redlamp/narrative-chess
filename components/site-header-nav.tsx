"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { Wordmark } from "@/components/wordmark";

type Props = {
  /** Logged-in user's display name, or null if signed out. */
  displayName: string | null;
};

export function SiteHeaderNav({ displayName }: Props) {
  const pathname = usePathname() ?? "/";
  const gameMatch = pathname.match(/^\/games\/([0-9a-f-]{36})$/i);
  const currentGameId = gameMatch?.[1] ?? null;

  const links: Array<{ href: string; label: string }> = [
    { href: "/games", label: "Games" },
  ];
  if (currentGameId) {
    links.push({ href: `/games/${currentGameId}`, label: "Current game" });
  }

  return (
    <header className="border-b border-rule bg-background">
      <nav className="max-w-5xl mx-auto px-4 h-12 flex items-center justify-between gap-4">
        <Link href="/" aria-label="Narrative Chess — home" className="text-foreground">
          <Wordmark size="sm" />
        </Link>
        <div className="flex items-center gap-1">
          {displayName && (
            <Link
              href="/account"
              className={cn(
                "px-3 py-1.5 font-body italic text-[14px] transition-colors mr-1",
                pathname === "/account"
                  ? "text-oxblood"
                  : "text-ink-soft hover:text-foreground",
              )}
              aria-current={pathname === "/account" ? "page" : undefined}
              title="Account"
            >
              {displayName}
            </Link>
          )}
          <ul className="flex items-center gap-1">
            {links.map((link) => {
              const active = pathname === link.href;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={cn(
                      "px-3 py-1.5 font-mono text-[10px] tracking-[0.18em] uppercase transition-colors",
                      active
                        ? "text-foreground"
                        : "text-ink-soft hover:text-foreground",
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
