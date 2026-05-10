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
    links.push({ href: `/games/${currentGameId}`, label: "Current" });
  }

  return (
    <header className="border-b border-rule bg-background">
      {/* min-h-12 keeps the 48px target height when the wordmark is on a
          single line (>= 820px). Below 820 the wordmark stacks to two
          lines (~46px tall at sm size) and py-2 lets the nav grow to
          accommodate without crushing the marks. */}
      <nav className="max-w-5xl mx-auto px-4 min-h-12 py-2 flex items-center justify-between gap-4">
        <Link href="/" aria-label="Narrative Chess" className="text-foreground">
          <Wordmark size="sm" layout="responsive" />
        </Link>
        <div className="flex items-center gap-1">
          {/* Baseline-align the display-name link with the nav-link list:
              both pieces of text drop into a flex items-baseline group so
              the italic Fraunces baseline sits flush with the mono uppercase
              baseline rather than floating higher per their default
              line-box centering. ThemeToggle stays outside this group so
              it keeps icon-centered. */}
          <div className="flex items-baseline gap-1">
            {displayName && (
              <Link
                href="/account"
                className={cn(
                  // px-1.5 default → px-3 at sm+ keeps the nav compact on
                  // phones while letting it breathe on tablets+.
                  "px-1.5 sm:px-3 py-1.5 font-body italic text-[14px] leading-none transition-colors mr-1",
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
            <ul className="flex items-baseline gap-1">
              {links.map((link) => {
                const active = pathname === link.href;
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className={cn(
                        "px-1.5 sm:px-3 py-1.5 font-mono text-[10px] leading-none tracking-[0.18em] uppercase transition-colors",
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
          </div>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
