"use client";

/**
 * Client wrapper for the games library page. Owns:
 *
 *   - Tab state ("Now playing" / "Archive") — survives router refresh because
 *     the parent server component re-renders both lists each time.
 *   - Page-load GSAP entrance for book cards: subtle rise + fade staggered
 *     across each visible section. Plays once per tab switch, then idles.
 *   - Empty-state copy for each section.
 *
 * Realtime refresh is mounted in GamesRealtime; on router.refresh() this
 * component remounts the section it's currently displaying and the GSAP
 * entrance re-fires, which reads as "the new book settling onto the shelf".
 */

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { GameBook, type GameRow } from "./GameBook";

type Tab = "now" | "archive";

type Props = {
  viewer: string;
  myActive: GameRow[];
  myOpen: GameRow[];
  otherOpen: GameRow[];
  myCompleted: GameRow[];
};

export function GamesLibrary({
  viewer,
  myActive,
  myOpen,
  otherOpen,
  myCompleted,
}: Props) {
  const [tab, setTab] = useState<Tab>("now");
  const stageRef = useRef<HTMLDivElement | null>(null);

  // Entrance animation. Targets every .book-card inside the active tab, then
  // staggers them up with a small per-card delay. Runs on tab change.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const cards = stage.querySelectorAll<HTMLElement>(".book-card");
    if (cards.length === 0) return;
    gsap.fromTo(
      cards,
      { opacity: 0, y: 14, rotate: -0.4 },
      {
        opacity: 1,
        y: 0,
        rotate: 0,
        duration: 0.55,
        ease: "power3.out",
        stagger: { each: 0.045, from: "start" },
      },
    );
  }, [tab]);

  const nowCount = myActive.length + myOpen.length + otherOpen.length;
  const archiveCount = myCompleted.length;

  return (
    <div ref={stageRef} className="space-y-12">
      <TabBar
        tab={tab}
        onChange={setTab}
        nowCount={nowCount}
        archiveCount={archiveCount}
      />

      {tab === "now" ? (
        <>
          <Shelf
            label="Your open challenges"
            count={myOpen.length}
            emphasis
            empty="You haven't started any open challenges. Press 'Begin a game' to lay one out."
          >
            {myOpen.map((row, i) => (
              <GameBook
                key={row.id}
                row={row}
                viewer={viewer}
                variant="compact"
                index={i + 1}
              />
            ))}
          </Shelf>

          <Shelf
            label="Active games"
            count={myActive.length}
            featured
            empty="No games in progress. Open invitations on the lower shelf are waiting for a hand."
          >
            {myActive.map((row, i) => (
              <GameBook
                key={row.id}
                row={row}
                viewer={viewer}
                variant="feature"
                index={i + 1}
              />
            ))}
          </Shelf>

          <Shelf
            label="Open invitations"
            count={otherOpen.length}
            subtitle="left by other players"
            empty="No open invitations on the wall right now. Check back, or post one of your own."
          >
            {otherOpen.map((row, i) => (
              <GameBook
                key={row.id}
                row={row}
                viewer={viewer}
                variant="compact"
                index={i + 1}
              />
            ))}
          </Shelf>
        </>
      ) : (
        <Shelf
          label="Archive"
          count={myCompleted.length}
          subtitle="completed volumes"
          empty="No games to bind into the archive yet. Finish one and it'll appear here."
        >
          {myCompleted.map((row, i) => (
            <GameBook
              key={row.id}
              row={row}
              viewer={viewer}
              variant="compact"
              index={i + 1}
            />
          ))}
        </Shelf>
      )}
    </div>
  );
}

function TabBar({
  tab,
  onChange,
  nowCount,
  archiveCount,
}: {
  tab: Tab;
  onChange: (t: Tab) => void;
  nowCount: number;
  archiveCount: number;
}) {
  return (
    <div className="library-tabs flex items-end justify-between border-b border-rule-soft pb-0">
      <div className="flex items-end gap-1">
        <TabButton
          active={tab === "now"}
          onClick={() => onChange("now")}
          label="Now playing"
          count={nowCount}
        />
        <TabButton
          active={tab === "archive"}
          onClick={() => onChange("archive")}
          label="Archive"
          count={archiveCount}
        />
      </div>
      <span className="hidden sm:block font-mono uppercase tracking-[0.22em] text-[10px] text-ink-faint pb-3">
        Catalogue · MMXXVI
      </span>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`library-tab relative px-5 pt-3 pb-3 -mb-px transition-colors ${
        active ? "library-tab--active" : ""
      }`}
    >
      <span
        className={`font-display ${
          active ? "text-foreground" : "text-ink-soft hover:text-ink"
        } text-2xl tracking-tight leading-none`}
      >
        {label}
      </span>
      <span className="ml-2 font-mono uppercase tracking-[0.14em] text-[10px] text-ink-faint tabular-nums align-text-top">
        {count}
      </span>
      {active && (
        <span
          aria-hidden
          className="absolute left-2 right-2 -bottom-px h-[2px]"
          style={{ background: "var(--oxblood)" }}
        />
      )}
    </button>
  );
}

function Shelf({
  label,
  count,
  subtitle,
  emphasis,
  featured,
  empty,
  children,
}: {
  label: string;
  count: number;
  subtitle?: string;
  emphasis?: boolean;
  featured?: boolean;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section className="library-shelf">
      <header className="flex items-baseline justify-between mb-5">
        <h2 className="font-display text-xl tracking-tight text-foreground">
          {label}
          {subtitle && (
            <span className="font-display italic text-ink-soft text-base ml-2">
              — {subtitle}
            </span>
          )}
        </h2>
        <span
          className={`font-mono uppercase tracking-[0.22em] text-[11px] tabular-nums ${
            emphasis ? "text-[var(--oxblood)]" : "text-ink-faint"
          }`}
        >
          {count.toString().padStart(2, "0")} {count === 1 ? "vol." : "vols."}
        </span>
      </header>

      {count === 0 ? (
        <p className="font-display italic text-ink-soft text-base max-w-prose pl-1">
          {empty}
        </p>
      ) : (
        <div
          className={`grid gap-5 ${
            featured
              ? "[grid-template-columns:repeat(auto-fill,minmax(320px,1fr))]"
              : "[grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]"
          }`}
        >
          {children}
        </div>
      )}
    </section>
  );
}
