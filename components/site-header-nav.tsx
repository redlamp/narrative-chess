"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { Wordmark } from "@/components/wordmark";

type Props = {
  /** Logged-in user's display name, or null if signed out. */
  displayName: string | null;
  /**
   * The user's most-recently active in-progress game (last-moved-by-them
   * with fallback to most recent participant game). Drives the "Current"
   * nav link visibility — shown whenever the user is in any in-progress
   * game, not only when the current URL is a game page.
   */
  currentGameId: string | null;
};

export function SiteHeaderNav({ displayName, currentGameId }: Props) {
  const pathname = usePathname() ?? "/";

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
        <div className="flex items-center gap-0 sm:gap-1">
          {/* Baseline-align the display-name link with the nav-link list:
              both pieces of text drop into a flex items-baseline group so
              the italic Fraunces baseline sits flush with the mono uppercase
              baseline rather than floating higher per their default
              line-box centering. ThemeToggle stays outside this group so
              it keeps icon-centered. Gaps shrink on narrow viewports
              (gap-0/mr-0 default → gap-1/mr-1 at sm+) so the inter-button
              breathing room matches the link padding's own narrow scaling. */}
          <div className="flex items-baseline gap-0 sm:gap-1">
            {displayName && (
              <Link
                href="/account"
                className={cn(
                  // px-1.5 default → px-3 at sm+ keeps the nav compact on
                  // phones while letting it breathe on tablets+.
                  "px-1.5 sm:px-3 py-1.5 font-body italic text-[14px] leading-none transition-colors mr-0 sm:mr-1",
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
            <ul className="flex items-baseline gap-0 sm:gap-1">
              {links.map((link) => {
                const active = pathname === link.href;
                // Current-game link hides below 380px (after the theme
                // toggle has already dropped out at 480) so the very
                // narrowest viewports only carry the brand + Games +
                // (optional) display-name. 'Games' itself never hides;
                // it's the canonical entry point.
                const isCurrent = link.label === "Current";
                return (
                  <li
                    key={link.href}
                    className={cn(isCurrent && "max-[380px]:hidden")}
                  >
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
          {/* Theme toggle drops out below 480px — first visual element
              to disappear as the window narrows. Theme stays toggleable
              via the OS / system preference (next-themes resolvedTheme)
              and the existing setting persists. */}
          <div className="max-[480px]:hidden">
            <ThemeToggle />
          </div>
        </div>
      </nav>
    </header>
  );
}
