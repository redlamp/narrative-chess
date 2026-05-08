# Frontend Pass 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the editorial-hybrid theme (Fraunces + Newsreader + JetBrains Mono, ink + cream + oxblood + signal-red palette, plinth-mounted 3D piece cluster, two-voice typography) from `design/variants/06-hybrid-3d.html` to the running Next.js app.

**Architecture:** Six-phase rollout on the existing `feat/frontend-pass-1` branch. Each phase produces a working app with progressively more theme applied; user reviews after each phase before moving to the next. No DB or API changes — frontend only. Existing Supabase queries, Server Actions, and RLS unchanged.

**Tech Stack:** Next.js 16.2 App Router, React 19, TypeScript, Tailwind v4, shadcn/ui, next-themes, @react-three/fiber + @react-three/drei (3D), gsap + @gsap/react (entrance animation), next/font/google (Fraunces, Newsreader, JetBrains Mono — all variable).

**Reference mockup:** `design/variants/06-hybrid-3d.html` is the source of truth for the target visual. Open it to verify colors, spacing, type scale, animation timing.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `app/layout.tsx` | modify | Replace Geist/Raleway/Inter with Fraunces (display) + Newsreader (body) + JetBrains Mono. Remove unused dependencies. |
| `app/globals.css` | modify | Editorial token palette (light + dark), scene tokens for 3D, font tokens, shadcn primary token swap teal→ink/oxblood. |
| `components/wordmark.tsx` | create | `Narrative` italic Fraunces + boxed `CHESS` JetBrains Mono. Reused in header + stage overlay. |
| `components/site-header.tsx` | modify | Use `<Wordmark/>`. |
| `components/site-header-nav.tsx` | modify | Editorial type for nav, oxblood active, mono auth labels. |
| `components/theme-toggle.tsx` | modify | Tighten icon-only square button. |
| `app/Hero3D.tsx` | modify | Camera config, ACES tone, env map, 3-pt light, fog, plinth, floor. |
| `app/HeroScene.tsx` | rewrite | Drop `Text3D`. Add plinth + floor. 5-piece cluster (bishop / king / queen back; pawn / rook front) at world `x = 1.24`. CSS-token-driven materials. GSAP entrance via `useGSAP`. Pointer parallax with camera looking straight forward. |
| `app/HeroPiece.tsx` | modify | `MeshPhysicalMaterial` (clearcoat + sheen). Color via prop (passed from CSS tokens). |
| `app/StageOverlay.tsx` | create | Masthead row + hero text block + CTAs. Absolute over Hero3D. |
| `app/page.tsx` | rewrite | Stage section (Hero3D + StageOverlay) + Frame section (LiveGameCard + StatPanels + GamesNowList + Colophon). |
| `app/StatPanels.tsx` | rewrite | Humanist eyebrow label + mono numeral. Same data fetch. |
| `app/LiveGameCard.tsx` | create | Featured-live-game card. Falls back to placeholder when no live games. |
| `app/GamesNowList.tsx` | create | Editorial table of in-progress games. Replaces inline list on `/`. |
| `app/Colophon.tsx` | create | Italic colophon line at bottom of landing. |
| `app/games/[gameId]/GameClient.tsx` | modify | Typography pass — Fraunces on player names, JetBrains Mono on clocks/move-list. No logic changes. |
| `app/games/[gameId]/Clock.tsx` | modify | Mono numerals + signal-red active state via theme token. |
| `app/games/[gameId]/TerminalBanner.tsx` | modify | Brighter editorial palette while keeping terminal feel. |
| `app/(auth)/login/page.tsx` + `LoginForm.tsx` | modify | Editorial heading + form styling. |
| `app/(auth)/sign-up/page.tsx` + `SignUpForm.tsx` | modify | Same. |
| `app/account/page.tsx` | modify | Apply tokens + typography. |
| `app/games/page.tsx` | modify | Editorial card pattern for games list. |
| `e2e/landing.spec.ts` | modify | Update text selectors for new headline `Games that tell stories.` |
| `e2e/site-header.spec.ts` | modify | Update wordmark selectors. |
| `wiki/projects/narrative-chess-v2.md` | modify | Append phase log when done. |

---

## Phase 1: Foundation — fonts + tokens

### Task 1.1: Commit mockups + plan as baseline

**Files:**
- Add: `design/variants/*.html`, `design/variants/README.md`
- Add: `docs/superpowers/plans/2026-05-07-frontend-pass-1.md`

- [ ] **Step 1: Stage and commit mockups**

```bash
cd C:/workspace/narrative-chess-v2
git add design/variants/
git commit -m "design(variants): editorial + cartographic + terminal + heritage + hybrid mockups

5 standalone HTML mockups exploring aesthetic directions for
narrative-chess-v2. Variant 06 (hybrid + 3D) is the chosen direction.
Reference for the frontend-pass-1 implementation."
```

- [ ] **Step 2: Stage and commit plan**

```bash
git add docs/superpowers/plans/2026-05-07-frontend-pass-1.md
git commit -m "docs(plan): frontend-pass-1 — editorial-hybrid theme port

6-phase rollout for the editorial + terminal hybrid aesthetic.
Target visual: design/variants/06-hybrid-3d.html."
```

### Task 1.2: Wire fonts in `app/layout.tsx`

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Replace font imports + variables**

Replace `app/layout.tsx` entirely:

```tsx
import type { Metadata } from "next";
import { Fraunces, Newsreader, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";

// Display — characterful serif with optical-sizing, soft, and wonk axes.
// Used for headings + the wordmark italic.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  axes: ["SOFT", "WONK", "opsz"],
});

// Body — magazine-grade variable serif.
const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-body",
  axes: ["opsz"],
});

// Mono — technical voice (clocks, move log, IDs, system metadata, boxed CHESS).
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Narrative Chess",
  description: "Games that tell stories.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "h-full",
        "antialiased",
        fraunces.variable,
        newsreader.variable,
        jetbrainsMono.variable,
      )}
    >
      <body className="min-h-full flex flex-col font-body">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SiteHeader />
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Verify TS compiles**

```bash
bunx tsc --noEmit
```

Expected: pass.

- [ ] **Step 3: Verify lint**

```bash
bun run lint
```

Expected: pass.

### Task 1.3: Editorial token palette in `app/globals.css`

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Replace `globals.css` entirely**

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  /* Surfaces */
  --color-background: var(--background);
  --color-foreground: var(--foreground);

  /* Type families */
  --font-display: var(--font-display);
  --font-body: var(--font-body);
  --font-mono: var(--font-mono);
  --font-sans: var(--font-body);
  --font-heading: var(--font-display);

  /* Editorial palette tokens (additive) */
  --color-ink: var(--ink);
  --color-ink-soft: var(--ink-soft);
  --color-ink-faint: var(--ink-faint);
  --color-rule: var(--rule);
  --color-rule-soft: var(--rule-soft);
  --color-bg-soft: var(--bg-soft);
  --color-bg-deep: var(--bg-deep);
  --color-oxblood: var(--oxblood);
  --color-signal: var(--signal);

  /* shadcn token mappings */
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-chart-5: var(--chart-5);
  --color-chart-4: var(--chart-4);
  --color-chart-3: var(--chart-3);
  --color-chart-2: var(--chart-2);
  --color-chart-1: var(--chart-1);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);

  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
  --radius-4xl: calc(var(--radius) * 2.6);
}

/* ============================================
   LIGHT — editorial cream + ink + oxblood
   ============================================ */
:root {
  /* Editorial */
  --ink: oklch(0.18 0.01 60);          /* #1a1815 */
  --ink-soft: oklch(0.42 0.01 60);     /* #5a554c */
  --ink-faint: oklch(0.62 0.01 60);    /* #8a8478 */
  --rule: oklch(0.21 0.01 60);         /* #2a2725 */
  --rule-soft: oklch(0.85 0.02 75);    /* #d6cdb9 */
  --background: oklch(0.94 0.02 75);   /* #f3ece1 cream */
  --foreground: oklch(0.18 0.01 60);   /* ink */
  --bg-soft: oklch(0.91 0.025 75);     /* #ebe2d2 */
  --bg-deep: oklch(0.86 0.035 75);     /* #e0d4be */
  --oxblood: oklch(0.40 0.13 25);      /* #7a1f25 */
  --signal: oklch(0.60 0.16 35);       /* #c84a2a */

  /* shadcn — primary swapped from teal to ink */
  --card: oklch(0.94 0.02 75);
  --card-foreground: oklch(0.18 0.01 60);
  --popover: oklch(0.94 0.02 75);
  --popover-foreground: oklch(0.18 0.01 60);
  --primary: oklch(0.18 0.01 60);            /* ink */
  --primary-foreground: oklch(0.94 0.02 75); /* cream */
  --secondary: oklch(0.91 0.025 75);
  --secondary-foreground: oklch(0.18 0.01 60);
  --muted: oklch(0.91 0.025 75);
  --muted-foreground: oklch(0.42 0.01 60);
  --accent: oklch(0.40 0.13 25);             /* oxblood */
  --accent-foreground: oklch(0.94 0.02 75);
  --destructive: oklch(0.60 0.16 35);        /* signal red doubles as destructive */
  --border: oklch(0.85 0.02 75);
  --input: oklch(0.85 0.02 75);
  --ring: oklch(0.40 0.13 25);               /* oxblood ring */

  /* charts — ink/oxblood/walnut family, no teal */
  --chart-1: oklch(0.40 0.13 25);
  --chart-2: oklch(0.55 0.10 35);
  --chart-3: oklch(0.42 0.05 60);
  --chart-4: oklch(0.30 0.04 60);
  --chart-5: oklch(0.55 0.06 80);

  --radius: 0.45rem;

  --sidebar: oklch(0.94 0.02 75);
  --sidebar-foreground: oklch(0.18 0.01 60);
  --sidebar-primary: oklch(0.40 0.13 25);
  --sidebar-primary-foreground: oklch(0.94 0.02 75);
  --sidebar-accent: oklch(0.91 0.025 75);
  --sidebar-accent-foreground: oklch(0.18 0.01 60);
  --sidebar-border: oklch(0.85 0.02 75);
  --sidebar-ring: oklch(0.40 0.13 25);

  /* 3D scene tokens */
  --scene-bg-top: oklch(0.94 0.02 75);
  --scene-bg-bot: oklch(0.83 0.04 80);
  --scene-floor: oklch(0.84 0.05 85);   /* #ddcca0 brighter */
  --scene-fog: oklch(0.91 0.025 80);
  --plinth-color: oklch(0.32 0.04 50);  /* warm walnut */
  --piece-light: oklch(0.92 0.04 80);
  --piece-dark: oklch(0.20 0.03 45);
}

/* ============================================
   DARK — warm walnut, not zinc
   ============================================ */
.dark {
  --ink: oklch(0.92 0.02 80);          /* #ece4d2 */
  --ink-soft: oklch(0.68 0.02 75);     /* #a89f8a */
  --ink-faint: oklch(0.45 0.015 65);
  --rule: oklch(0.30 0.02 60);
  --rule-soft: oklch(0.20 0.015 60);
  --background: oklch(0.16 0.01 60);   /* #181612 */
  --foreground: oklch(0.92 0.02 80);
  --bg-soft: oklch(0.20 0.015 60);
  --bg-deep: oklch(0.24 0.02 65);
  --oxblood: oklch(0.62 0.13 22);      /* lifted for dark contrast */
  --signal: oklch(0.68 0.15 35);

  --card: oklch(0.20 0.015 60);
  --card-foreground: oklch(0.92 0.02 80);
  --popover: oklch(0.20 0.015 60);
  --popover-foreground: oklch(0.92 0.02 80);
  --primary: oklch(0.92 0.02 80);            /* cream as primary in dark */
  --primary-foreground: oklch(0.16 0.01 60); /* ink */
  --secondary: oklch(0.24 0.02 65);
  --secondary-foreground: oklch(0.92 0.02 80);
  --muted: oklch(0.24 0.02 65);
  --muted-foreground: oklch(0.68 0.02 75);
  --accent: oklch(0.62 0.13 22);
  --accent-foreground: oklch(0.92 0.02 80);
  --destructive: oklch(0.68 0.15 35);
  --border: oklch(0.30 0.02 60);
  --input: oklch(0.30 0.02 60);
  --ring: oklch(0.62 0.13 22);

  --chart-1: oklch(0.62 0.13 22);
  --chart-2: oklch(0.68 0.10 35);
  --chart-3: oklch(0.55 0.05 70);
  --chart-4: oklch(0.42 0.04 65);
  --chart-5: oklch(0.70 0.06 85);

  --sidebar: oklch(0.20 0.015 60);
  --sidebar-foreground: oklch(0.92 0.02 80);
  --sidebar-primary: oklch(0.62 0.13 22);
  --sidebar-primary-foreground: oklch(0.92 0.02 80);
  --sidebar-accent: oklch(0.24 0.02 65);
  --sidebar-accent-foreground: oklch(0.92 0.02 80);
  --sidebar-border: oklch(0.30 0.02 60);
  --sidebar-ring: oklch(0.62 0.13 22);

  --scene-bg-top: oklch(0.16 0.01 60);
  --scene-bg-bot: oklch(0.22 0.025 50);
  --scene-floor: oklch(0.27 0.03 60);  /* brighter than before */
  --scene-fog: oklch(0.18 0.015 55);
  --plinth-color: oklch(0.22 0.03 55);
  --piece-light: oklch(0.84 0.05 85);
  --piece-dark: oklch(0.16 0.025 50);
}

@layer base {
  * { @apply border-border outline-ring/50; }
  body {
    @apply bg-background text-foreground;
    font-feature-settings: "ss01", "kern";
  }
  html { font-family: var(--font-body); }
}
```

- [ ] **Step 2: Verify build + lint**

```bash
bunx tsc --noEmit && bun run lint
```

Expected: pass.

- [ ] **Step 3: Visual sanity check (manual)**

```bash
bun run dev
```

Open `http://localhost:3000`. Existing pages should render with new cream-and-ink palette but layout unchanged. Verify: text is readable, no broken colors, dark mode toggle works.

### Task 1.4: Commit Phase 1

- [ ] **Step 1: Stage + commit**

```bash
git add app/layout.tsx app/globals.css
git commit -m "feat(theme): editorial palette + Fraunces/Newsreader/JetBrains Mono fonts

Replaces shadcn-default teal primary with ink + oxblood + cream editorial
palette. Drops Geist/Raleway/Inter in favour of three variable Google fonts
keyed to roles: Fraunces (display), Newsreader (body), JetBrains Mono
(technical). Adds scene tokens for the 3D hero and editorial color tokens
(ink, ink-soft, oxblood, signal, rule). Dark mode shifted to warm walnut.

Phase 1 of frontend-pass-1. See docs/superpowers/plans/2026-05-07-frontend-pass-1.md."
```

---

## Phase 2: Site shell — wordmark + header + theme toggle

### Task 2.1: Create `components/wordmark.tsx`

**Files:**
- Create: `components/wordmark.tsx`

- [ ] **Step 1: Write component**

```tsx
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  size?: "sm" | "md";
};

/**
 * Two-voice wordmark — italic Fraunces "Narrative" + boxed JetBrains Mono
 * "CHESS". Sets the entire app's typographic rule (humanist for narrative
 * voice, mono for technical voice) right at the front door.
 */
export function Wordmark({ className, size = "md" }: Props) {
  const narrSize = size === "sm" ? "text-[20px]" : "text-[28px]";
  const chessSize = size === "sm" ? "text-[10px] px-1.5 py-[3px]" : "text-[14px] px-1.5 py-1";

  return (
    <span className={cn("inline-flex items-baseline", className)}>
      <span
        className={cn(
          "font-display italic font-[380] tracking-tight",
          narrSize,
        )}
        style={{ fontVariationSettings: '"opsz" 144, "SOFT" 100, "WONK" 1' }}
      >
        Narrative
      </span>
      <span
        className={cn(
          "font-mono font-bold uppercase border-[1.5px] border-foreground self-center ml-2.5 leading-none",
          chessSize,
        )}
        style={{ letterSpacing: "0.06em" }}
      >
        CHESS
      </span>
    </span>
  );
}
```

- [ ] **Step 2: Verify TS compiles**

```bash
bunx tsc --noEmit
```

Expected: pass.

### Task 2.2: Use Wordmark in `components/site-header-nav.tsx`

**Files:**
- Modify: `components/site-header-nav.tsx`

- [ ] **Step 1: Read current file**

Read `components/site-header-nav.tsx` to know exact structure (it currently has its own header markup).

- [ ] **Step 2: Replace the brand link with `<Wordmark/>`**

Locate the existing brand `<Link href="/">…</Link>` and replace its children with `<Wordmark size="sm" />`. Keep the link wrapper, route attributes, and surrounding nav unchanged. Apply editorial styling to nav links — Newsreader italic for active, mono small caps for muted.

Concrete diff: anywhere the file uses `font-heading` swap to `font-display`. Anywhere it uses `font-bold` for the wordmark, delete (Wordmark handles its own type).

- [ ] **Step 3: Verify TS + lint**

```bash
bunx tsc --noEmit && bun run lint
```

### Task 2.3: Tighten `components/theme-toggle.tsx`

**Files:**
- Modify: `components/theme-toggle.tsx`

- [ ] **Step 1: Replace component**

```tsx
"use client";

import { useTheme } from "next-themes";
import { MoonIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      title="Toggle theme"
      className="h-9 w-9 rounded-none border border-rule"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <SunIcon className="size-4 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
      <MoonIcon className="absolute size-4 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
```

Note: `border-rule` is from the new `--color-rule` token. If Tailwind v4 doesn't pick it up automatically, fall back to `border-border` and adjust later.

- [ ] **Step 2: Verify TS + lint**

```bash
bunx tsc --noEmit && bun run lint
```

### Task 2.4: Commit Phase 2

```bash
git add components/wordmark.tsx components/site-header.tsx components/site-header-nav.tsx components/theme-toggle.tsx
git commit -m "feat(header): editorial wordmark + tightened theme toggle

Adds <Wordmark> — italic Fraunces 'Narrative' + boxed JetBrains Mono
'CHESS'. Replaces the bold serif brand text in the site header. Theme
toggle is now a 36×36 icon-only square button matching the editorial
hairline-rule aesthetic.

Phase 2 of frontend-pass-1."
```

---

## Phase 3: 3D hero rebuild

### Task 3.1: Rewrite `app/HeroPiece.tsx` — physical material

**Files:**
- Modify: `app/HeroPiece.tsx`

- [ ] **Step 1: Replace material call**

Find the line:

```tsx
const mat = (
  <meshStandardMaterial color={COLORS[color]} roughness={0.55} metalness={0.05} />
);
```

Replace with:

```tsx
const mat = (
  <meshPhysicalMaterial
    color={COLORS[color]}
    roughness={0.42}
    metalness={0.08}
    clearcoat={0.18}
    clearcoatRoughness={0.4}
    sheen={0.3}
    sheenColor="#ffffff"
  />
);
```

Add `castShadow` and `receiveShadow` to every `<mesh>` in the file (each base + body + decoration).

- [ ] **Step 2: Make piece colors theme-aware**

Replace `const COLORS = { white: "#f4f4f5", black: "#18181b" }` with a hook that reads CSS tokens:

```tsx
import { useEffect, useState } from "react";

function useThemePieceColor(color: "white" | "black") {
  const [hex, setHex] = useState(color === "white" ? "#f3e8cf" : "#2a1c12");

  useEffect(() => {
    const cs = getComputedStyle(document.documentElement);
    const tok = color === "white" ? "--piece-light" : "--piece-dark";
    setHex(cs.getPropertyValue(tok).trim() || hex);
    // Re-read when theme attribute changes
    const obs = new MutationObserver(() => {
      const next = getComputedStyle(document.documentElement).getPropertyValue(tok).trim();
      if (next) setHex(next);
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, [color, hex]);

  return hex;
}
```

Replace `COLORS[color]` usage with `const pieceColor = useThemePieceColor(color);` and use `color={pieceColor}` in the material.

- [ ] **Step 3: Verify TS + lint**

```bash
bunx tsc --noEmit && bun run lint
```

### Task 3.2: Rewrite `app/HeroScene.tsx`

**Files:**
- Modify: `app/HeroScene.tsx`

- [ ] **Step 1: Replace file content entirely**

Drop `Text3D` and the title rendering. The wordmark + headline now live as HTML overlay. New scene content:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { MathUtils } from "three";
import * as THREE from "three";
import { HeroPiece } from "./HeroPiece";

// Plinth dimensions and world position. Plinth.x is the horizontal anchor
// for the cluster — pulled toward right by camera frustum so the cluster
// lands in the right third of the visible stage.
const PLINTH = { x: 1.24, y: 0.5, z: 0, w: 3.0, h: 1.0, d: 1.6 };
const PLINTH_TOP = PLINTH.y + PLINTH.h / 2;

// 5-piece cluster — back row taller (bishop / king / queen), front row
// shorter (pawn / rook). Centers ≥ 1.0 apart so bases don't overlap.
const LAYOUT = [
  { kind: "bishop", color: "white", x: -1.10, z: -0.45, ry: 0.30 },
  { kind: "king",   color: "white", x:  0.00, z: -0.45, ry: 0.00 },
  { kind: "queen",  color: "black", x:  1.10, z: -0.45, ry: -0.20 },
  { kind: "pawn",   color: "white", x: -0.55, z:  0.55, ry: 0.20 },
  { kind: "rook",   color: "black", x:  0.55, z:  0.55, ry: -0.40 },
] as const;

function useSceneTokens() {
  const [tokens, setTokens] = useState({ floor: "#ddcca0", plinth: "#5a4128", fog: "#e8dcc4" });
  useEffect(() => {
    const read = () => {
      const cs = getComputedStyle(document.documentElement);
      setTokens({
        floor: cs.getPropertyValue("--scene-floor").trim() || "#ddcca0",
        plinth: cs.getPropertyValue("--plinth-color").trim() || "#5a4128",
        fog: cs.getPropertyValue("--scene-fog").trim() || "#e8dcc4",
      });
    };
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return tokens;
}

type Tilt = { x: number; y: number; active: boolean };

export function HeroScene() {
  const tokens = useSceneTokens();
  const tilt = useRef<Tilt>({ x: 0, y: 0, active: false });
  const groupRef = useRef<THREE.Group>(null);
  const pieceRefs = useRef<(THREE.Group | null)[]>([]);

  // Device-orientation parallax — same as before.
  useEffect(() => {
    const handler = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      tilt.current.x = MathUtils.clamp(e.gamma / 25, -1, 1);
      tilt.current.y = MathUtils.clamp((e.beta - 45) / 25, -1, 1);
      tilt.current.active = true;
    };
    window.addEventListener("deviceorientation", handler);
    return () => window.removeEventListener("deviceorientation", handler);
  }, []);

  // Camera + parallax — camera looks straight forward; cluster sits right
  // because of world position, not lookAt.
  useFrame((state, dt) => {
    const t = tilt.current;
    const px = t.active ? t.x : state.pointer.x;
    const py = t.active ? t.y : state.pointer.y;
    state.camera.position.x = MathUtils.damp(state.camera.position.x, px * 0.4, 4, dt);
    state.camera.position.y = MathUtils.damp(state.camera.position.y, 1.7 + py * 0.25, 4, dt);
    state.camera.lookAt(0, 1.0, 0);
  });

  // Entrance — pieces drop onto the plinth, staggered.
  useGSAP(() => {
    const tl = gsap.timeline({ delay: 0.15 });
    pieceRefs.current.forEach((p, i) => {
      if (!p) return;
      const finalY = p.position.y;
      p.position.y = finalY + 4.0;
      p.scale.set(0.85, 0.85, 0.85);
      const finalRy = p.rotation.y;
      p.rotation.y = finalRy - 0.4;
      tl.to(p.position, { y: finalY, duration: 0.9, ease: "power3.out" }, 0.3 + i * 0.1);
      tl.to(p.scale, { x: 1, y: 1, z: 1, duration: 0.85, ease: "back.out(1.4)" }, 0.3 + i * 0.1);
      tl.to(p.rotation, { y: finalRy, duration: 1.0, ease: "power2.out" }, 0.3 + i * 0.1);
    });
  }, { scope: groupRef });

  return (
    <>
      <fog attach="fog" args={[tokens.fog, 9, 24]} />
      <hemisphereLight args={["#fbf3df", "#6a5a3a", 0.55]} />
      <directionalLight
        position={[5, 7, 4]}
        intensity={1.6}
        color="#ffe8c2"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={22}
        shadow-camera-left={-2}
        shadow-camera-right={9}
        shadow-camera-top={5}
        shadow-camera-bottom={-2}
        shadow-bias={-0.0008}
        shadow-radius={4}
      />
      <directionalLight position={[-4, 3, -3]} intensity={0.4} color="#c6d8e0" />

      {/* Floor */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 16]} />
        <meshStandardMaterial color={tokens.floor} roughness={0.95} transparent opacity={0.85} />
      </mesh>

      {/* Plinth */}
      <mesh position={[PLINTH.x, PLINTH.y, PLINTH.z]} castShadow receiveShadow>
        <boxGeometry args={[PLINTH.w, PLINTH.h, PLINTH.d]} />
        <meshPhysicalMaterial color={tokens.plinth} roughness={0.55} clearcoat={0.25} clearcoatRoughness={0.5} />
      </mesh>

      {/* Cluster on plinth top */}
      <group ref={groupRef} position={[PLINTH.x, PLINTH_TOP, 0]}>
        {LAYOUT.map((p, i) => (
          <group
            key={`${p.kind}-${p.color}-${i}`}
            ref={(el) => { pieceRefs.current[i] = el; }}
            position={[p.x, 0, p.z]}
            rotation={[0, p.ry, 0]}
          >
            <HeroPiece kind={p.kind} color={p.color} />
          </group>
        ))}
      </group>
    </>
  );
}
```

- [ ] **Step 2: Verify TS + lint**

```bash
bunx tsc --noEmit && bun run lint
```

### Task 3.3: Update `app/Hero3D.tsx` — canvas config

**Files:**
- Modify: `app/Hero3D.tsx`

- [ ] **Step 1: Replace file content**

```tsx
"use client";

import { Canvas, type RootState } from "@react-three/fiber";
import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace } from "three";
import { Environment } from "@react-three/drei";
import { HeroScene } from "./HeroScene";

function attachContextRecovery({ gl, invalidate }: RootState) {
  const canvas = gl.domElement;
  canvas.addEventListener("webglcontextlost", (e) => e.preventDefault());
  canvas.addEventListener("webglcontextrestored", () => invalidate());
}

export default function Hero3D() {
  return (
    <div className="absolute inset-0 z-0 pointer-events-none">
      <Canvas
        camera={{ position: [0, 1.7, 7.5], fov: 36 }}
        dpr={[1, 2]}
        shadows
        gl={{ antialias: true, alpha: true }}
        onCreated={(state) => {
          state.gl.shadowMap.enabled = true;
          state.gl.shadowMap.type = PCFSoftShadowMap;
          state.gl.outputColorSpace = SRGBColorSpace;
          state.gl.toneMapping = ACESFilmicToneMapping;
          state.gl.toneMappingExposure = 1.05;
          attachContextRecovery(state);
        }}
      >
        <Environment preset="apartment" environmentIntensity={0.4} />
        <HeroScene />
      </Canvas>
    </div>
  );
}
```

- [ ] **Step 2: Update `app/Hero3DLoader.tsx`**

If `Hero3DLoader.tsx` exists and wraps Hero3D in a Suspense + skeleton, leave the wrapping but ensure the skeleton's height matches the new stage (60vh, min 460px).

- [ ] **Step 3: Verify TS + lint**

```bash
bunx tsc --noEmit && bun run lint
```

### Task 3.4: Commit Phase 3

```bash
git add app/Hero3D.tsx app/HeroScene.tsx app/HeroPiece.tsx app/Hero3DLoader.tsx
git commit -m "feat(hero): plinth + clustered cluster + GSAP entrance + theme-aware materials

- Drops Text3D — title moves to HTML overlay (sharper, themable, a11y)
- Adds walnut plinth (3.0×1.0×1.6) at world x=1.24, lands cluster in right
  third of stage with camera looking straight forward
- 5-piece cluster: back row bishop/king/queen, front row pawn/rook;
  base centres ≥1.0 apart so bases don't intersect
- 3-point lighting (warm key + cool rim + hemi), ACES tone, env map
- MeshPhysicalMaterial (clearcoat + sheen) on pieces
- Reads --scene-floor, --plinth-color, --piece-light/dark CSS tokens;
  re-reads on theme class change
- GSAP timeline via useGSAP — pieces drop, scale-overshoot, settle rotation

Phase 3 of frontend-pass-1."
```

---

## Phase 4: Landing layout

### Task 4.1: Build `app/StageOverlay.tsx`

**Files:**
- Create: `app/StageOverlay.tsx`

- [ ] **Step 1: Write component**

```tsx
import Link from "next/link";
import { Wordmark } from "@/components/wordmark";

type Props = {
  authed: boolean;
  liveCount: number;
  date: string;
};

/**
 * Editorial overlay that sits on top of the 3D hero canvas. Three rows:
 * masthead, spacer, hero text + CTAs. The hero text is constrained to
 * the LEFT half so the right-side piece cluster stays unobstructed.
 */
export function StageOverlay({ authed, liveCount, date }: Props) {
  return (
    <div className="relative z-10 h-full max-w-[1180px] mx-auto px-14 py-7 grid grid-rows-[auto_1fr_auto] pointer-events-none">
      {/* Masthead */}
      <header className="grid grid-cols-[1fr_auto_1fr] items-center pb-3 border-b border-rule pointer-events-auto">
        <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-soft inline-flex items-center">
          <span className="inline-block size-[6px] bg-signal mr-2 rounded-full animate-pulse" />
          {liveCount} live now
        </div>
        <Wordmark size="md" />
        <div className="text-right font-body italic text-[13px] text-ink-soft">{date}</div>
      </header>

      <div />

      {/* Hero text — bottom-left */}
      <div className="self-end max-w-[36ch] pointer-events-auto">
        <h1
          className="font-display font-[360] leading-[0.96] tracking-[-0.022em]"
          style={{
            fontVariationSettings: '"opsz" 144, "SOFT" 50, "WONK" 0',
            fontSize: "clamp(40px, 5.4vw, 76px)",
          }}
        >
          Games
          <br />
          <em
            className="not-italic"
            style={{
              fontStyle: "italic",
              fontVariationSettings: '"opsz" 144, "SOFT" 100, "WONK" 1',
              color: "var(--oxblood)",
              fontWeight: 320,
            }}
          >
            that tell
          </em>
          <br />
          stories.
        </h1>

        <p className="mt-3.5 font-body italic font-[320] text-[17px] leading-[1.45] text-ink-soft">
          Two players sit. A board opens. Somewhere between move 1 and the
          resignation, a story arrives — and the engine quietly records it.
        </p>

        <div className="mt-5 flex gap-3">
          <Link
            href={authed ? "/games/new" : "/sign-up"}
            className="inline-flex items-center px-5 py-3 bg-foreground text-background font-display italic font-[380] text-[16px] border border-foreground hover:bg-oxblood hover:border-oxblood transition-colors"
            style={{ fontVariationSettings: '"opsz" 96, "SOFT" 50' }}
          >
            Begin a game
            <span className="font-mono not-italic font-medium text-[12px] ml-3 opacity-70">→</span>
          </Link>
          {!authed && (
            <Link
              href="/login"
              className="inline-flex items-center px-4 py-3 bg-transparent text-foreground border border-rule font-mono text-[11px] tracking-[0.18em] uppercase hover:bg-foreground hover:text-background hover:border-foreground transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
```

### Task 4.2: Rewrite `app/StatPanels.tsx`

**Files:**
- Modify: `app/StatPanels.tsx`

- [ ] **Step 1: Replace component (keep data fetch)**

```tsx
import { createClient } from "@/lib/supabase/server";

type Stats = {
  games_played: number;
  active_games: number;
  accounts: number;
};

async function fetchStats(): Promise<Stats> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_stats").single();
  if (error || !data) {
    return { games_played: 0, active_games: 0, accounts: 0 };
  }
  const row = data as {
    games_played: number | string;
    active_games: number | string;
    accounts: number | string;
  };
  return {
    games_played: Number(row.games_played) || 0,
    active_games: Number(row.active_games) || 0,
    accounts: Number(row.accounts) || 0,
  };
}

export async function StatPanels() {
  const stats = await fetchStats();

  const panels = [
    { eyebrow: "Now playing", value: stats.active_games, label: "Live games on the boards at this hour." },
    { eyebrow: "Today",       value: stats.games_played, label: "Games begun since this morning." },
    { eyebrow: "All accounts", value: stats.accounts,    label: "Members who have signed up." },
  ];

  return (
    <section className="grid grid-cols-1 sm:grid-cols-3 gap-8 py-12 border-t-2 border-rule border-b border-rule">
      {panels.map((p) => (
        <div key={p.eyebrow} className="grid grid-cols-[auto_1fr] gap-4 items-baseline">
          <div className="font-mono font-semibold text-[56px] leading-[0.9] tracking-[-0.02em] text-oxblood tabular-nums">
            {p.value.toLocaleString()}
          </div>
          <div className="font-body italic text-[15px] leading-[1.4] text-ink-soft">
            <strong className="block font-mono not-italic font-medium text-[9px] tracking-[0.22em] uppercase text-foreground mb-1.5">
              {p.eyebrow}
            </strong>
            {p.label}
          </div>
        </div>
      ))}
    </section>
  );
}
```

### Task 4.3: Build `app/LiveGameCard.tsx` (placeholder for now)

**Files:**
- Create: `app/LiveGameCard.tsx`

- [ ] **Step 1: Write minimal placeholder**

```tsx
import { createClient } from "@/lib/supabase/server";

/**
 * Featured live-game card. For phase 4, fetches the most recently created
 * in-progress game and shows player names + status. Real-time updates are
 * deferred — the existing /games page handles that.
 */
export async function LiveGameCard() {
  const supabase = await createClient();
  const { data: game } = await supabase
    .from("games")
    .select("id, status, created_at, white_id, black_id, time_control_type")
    .eq("status", "in_progress")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!game) {
    return (
      <aside className="border border-rule bg-bg-soft text-foreground mb-20 p-6 text-center font-body italic text-ink-soft">
        No games in progress at the moment. <a className="text-oxblood underline-offset-2 hover:underline" href="/games/new">Begin one →</a>
      </aside>
    );
  }

  return (
    <aside className="border border-rule bg-bg-soft text-foreground mb-20 overflow-hidden">
      <div className="flex justify-between items-center px-4 py-2.5 border-b border-rule-soft font-mono text-[10px] tracking-[0.18em] uppercase text-ink-soft">
        <span className="text-foreground font-medium inline-flex items-center">
          <span className="inline-block size-[6px] bg-signal rounded-full mr-2 animate-pulse" />
          Live · Game {game.id.slice(0, 4)}
        </span>
        <span>{game.time_control_type ?? "Untimed"}</span>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
          <div>
            <div className="font-display text-[22px] leading-[1.1]">player_a</div>
            <div className="font-mono text-[10px] tracking-[0.1em] text-ink-faint mt-1 uppercase">White</div>
          </div>
          <div className="font-body italic text-sm text-ink-faint">vs</div>
          <div className="text-right">
            <div className="font-display text-[22px] leading-[1.1]">player_b</div>
            <div className="font-mono text-[10px] tracking-[0.1em] text-ink-faint mt-1 uppercase">Black</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
```

Note: This is intentionally simple. Once Phase 4 lands, a follow-up can wire profiles + clocks + realtime. The schema query only references columns that already exist in M1.5++.

### Task 4.4: Rewrite `app/page.tsx`

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace file**

```tsx
import { createClient } from "@/lib/supabase/server";
import { Hero3DLoader } from "./Hero3DLoader";
import { StageOverlay } from "./StageOverlay";
import { StatPanels } from "./StatPanels";
import { LiveGameCard } from "./LiveGameCard";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { count: liveCount } = await supabase
    .from("games")
    .select("id", { count: "exact", head: true })
    .eq("status", "in_progress");

  const dateLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  return (
    <>
      {/* Stage — 3D hero behind editorial overlay */}
      <section className="relative w-full h-[60vh] min-h-[460px] overflow-hidden bg-gradient-to-b from-[var(--scene-bg-top)] to-[var(--scene-bg-bot)]">
        <Hero3DLoader />
        <StageOverlay authed={!!user} liveCount={liveCount ?? 0} date={dateLabel} />
        {/* Subtle vignette + grain */}
        <div className="absolute inset-0 pointer-events-none mix-blend-multiply [background:radial-gradient(ellipse_at_center,transparent_50%,rgba(0,0,0,0.18)_100%),repeating-linear-gradient(45deg,rgba(0,0,0,0.012)_0_1px,transparent_1px_3px)]" />
      </section>

      {/* Frame — editorial flow below stage */}
      <main className="max-w-[1180px] mx-auto px-14 pt-16 pb-24">
        <LiveGameCard />
        <StatPanels />
      </main>
    </>
  );
}
```

Note: The existing landing also showed AuthHeader inline. With Wordmark + masthead now in StageOverlay + SiteHeader, the inline AuthHeader is redundant. Delete `app/AuthHeader.tsx` if no other page uses it. Run `grep -r AuthHeader app/` before deleting.

- [ ] **Step 2: Check for unused AuthHeader**

```bash
grep -rn "AuthHeader" app/ components/
```

If only `app/page.tsx` and `app/AuthHeader.tsx` itself match, delete `app/AuthHeader.tsx`.

```bash
git rm app/AuthHeader.tsx
```

- [ ] **Step 3: Verify TS + lint**

```bash
bunx tsc --noEmit && bun run lint
```

### Task 4.5: Update `e2e/landing.spec.ts`

**Files:**
- Modify: `e2e/landing.spec.ts`

- [ ] **Step 1: Read current spec**

```bash
cat e2e/landing.spec.ts
```

- [ ] **Step 2: Update text-content selectors**

The landing now uses "Games that tell stories." instead of "Narrative Chess" hero text. Update assertions:

```ts
// Was:
await expect(page.getByRole("heading", { name: /narrative chess/i })).toBeVisible();

// Now:
await expect(page.getByRole("heading", { name: /games\s+that tell\s+stories/i })).toBeVisible();
```

Wordmark itself ("Narrative" + "CHESS") is in the masthead and SiteHeader. It can still be asserted by aria-label or role.

- [ ] **Step 3: Run e2e**

```bash
bunx playwright test e2e/landing.spec.ts
```

Expected: pass.

### Task 4.6: Commit Phase 4

```bash
git add app/StageOverlay.tsx app/StatPanels.tsx app/LiveGameCard.tsx app/page.tsx e2e/landing.spec.ts
git rm app/AuthHeader.tsx 2>/dev/null || true
git commit -m "feat(landing): editorial stage overlay + new stats + live game card

- StageOverlay places masthead + hero text + CTAs over the 3D canvas;
  hero text is constrained to the left half so the piece cluster stays clean
- StatPanels rewritten to humanist label + mono numeral pattern;
  same data fetch via public_stats RPC
- New LiveGameCard pulls the most recent in_progress game; falls back to
  an empty-state link when none exist
- page.tsx restructured into Stage section + Frame section; AuthHeader
  removed (its content is now in SiteHeader + StageOverlay)

Phase 4 of frontend-pass-1."
```

---

## Phase 5: Other pages — typography pass

Goal: ensure no page still reads as shadcn-default. This phase doesn't restructure layouts; it just swaps fonts + tokens on existing pages.

### Task 5.1: Game page typography

**Files:**
- Modify: `app/games/[gameId]/GameClient.tsx`
- Modify: `app/games/[gameId]/Clock.tsx`
- Modify: `app/games/[gameId]/TerminalBanner.tsx`

- [ ] **Step 1: Audit each file for type classes**

Look for:
- `font-heading`, `font-bold` on headings → replace with `font-display`
- `font-mono` on data → keep (just verify the font wires up)
- Tailwind color classes referencing teal / zinc → swap to `text-foreground` / `text-ink-soft` / `text-oxblood` / `text-signal`
- Player names → `font-display`, italic for opponent
- Clock numerals → `font-mono tabular-nums`, signal-red on active

- [ ] **Step 2: Apply changes per file**

Specific bits:
- `Clock.tsx` line 77: change `text-red-600 animate-pulse` → `text-signal animate-pulse`
- `TerminalBanner.tsx`: ensure mono font + cream-on-ink palette via tokens
- `GameClient.tsx`: player labels + status badges to humanist + technical roles per Wordmark/StageOverlay rules

- [ ] **Step 3: Verify TS + lint**

```bash
bunx tsc --noEmit && bun run lint
```

### Task 5.2: Auth + account pages typography

**Files:**
- Modify: `app/(auth)/login/page.tsx`, `app/(auth)/login/LoginForm.tsx`
- Modify: `app/(auth)/sign-up/page.tsx`, `app/(auth)/sign-up/SignUpForm.tsx`
- Modify: `app/account/page.tsx`

- [ ] **Step 1: Replace headings + body type**

H1 on each page → `font-display italic` Fraunces. Body text → `font-body`. Form labels → `font-mono` small caps. Submit button → match StageOverlay primary CTA pattern (italic Fraunces on ink fill).

- [ ] **Step 2: Verify TS + lint**

```bash
bunx tsc --noEmit && bun run lint
```

### Task 5.3: Games directory + new-game form

**Files:**
- Modify: `app/games/page.tsx`
- Modify: `app/games/new/NewGameForm.tsx`
- Modify: `app/games/new/page.tsx`

- [ ] **Step 1: Apply editorial card pattern**

The existing list rows on `/games` should adopt the GamesNowList pattern from the mockup: humanist player names + mono clock pair + italic opening + "Watch →" italic link.

- [ ] **Step 2: Verify TS + lint + e2e**

```bash
bunx tsc --noEmit && bun run lint
bunx playwright test e2e/games-directory.spec.ts
```

### Task 5.4: Commit Phase 5

```bash
git add -p   # interactive — group commits per logical chunk
# or:
git add app/games/[gameId]/ app/(auth)/ app/account/ app/games/page.tsx app/games/new/
git commit -m "feat(pages): editorial typography on game/auth/account/games-directory pages

Apply Fraunces (display) + Newsreader (body) + JetBrains Mono (technical)
roles to all remaining app pages. No logic changes — just type + tokens.

Phase 5 of frontend-pass-1."
```

---

## Phase 6: e2e + ship

### Task 6.1: Full test pass

- [ ] **Step 1: Lint + typecheck**

```bash
bun run lint
bunx tsc --noEmit
```

Both should pass.

- [ ] **Step 2: Run all e2e**

```bash
bunx playwright test
```

If specs reference colour classes or removed text, update them. Common updates:
- `landing.spec.ts` — already done in Task 4.5
- `site-header.spec.ts` — wordmark structure changed; selectors via role/text should still work
- `auth-dialog.spec.ts` — verify AuthDialog still triggers from CTA
- `clocks-display.spec.ts` — selectors should be unaffected (mono numerals + tabular-nums)

### Task 6.2: Visual review on hosted dev

- [ ] **Step 1: Push branch**

```bash
git push -u origin feat/frontend-pass-1
```

- [ ] **Step 2: Wait for Vercel preview deployment**

Verify `/`, `/login`, `/sign-up`, `/account`, `/games`, `/games/new`, `/games/<id>` all render with the new theme on both light + dark modes.

### Task 6.3: Update wiki

**Files:**
- Modify: `wiki/projects/narrative-chess-v2.md`

- [ ] **Step 1: Append phase log**

Add an entry under the Phases-shipped table:

```md
| frontend-pass-1 | (PR #__) | Editorial-hybrid theme: Fraunces+Newsreader+JetBrains Mono fonts, ink+oxblood+cream palette, plinth-mounted 3D cluster, two-voice typography, themed landing/header/auth/account/game pages. Reference mockup at design/variants/06-hybrid-3d.html. |
```

Update branch state line to reflect the PR.

### Task 6.4: Open PR

- [ ] **Step 1: Create PR `feat/frontend-pass-1` → `dev`**

```bash
gh pr create --base dev --head feat/frontend-pass-1 \
  --title "feat: frontend pass 1 — editorial-hybrid theme" \
  --body "Implements docs/superpowers/plans/2026-05-07-frontend-pass-1.md.

Six phases:
1. Foundation — fonts + editorial token palette
2. Site shell — Wordmark + nav + theme toggle
3. 3D hero — plinth + cluster + GSAP entrance
4. Landing layout — stage overlay + stats + live game card
5. Other pages — typography pass on game/auth/account
6. Tests + visual review

Reference mockup: design/variants/06-hybrid-3d.html.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 2: Wait for CI green + user review**

After user approves and tests preview:
- Merge `feat/frontend-pass-1` → `dev` via `gh pr merge --merge`
- Open separate PR `dev` → `main` via `gh pr merge --squash` (per CLAUDE.md branch policy)

---

## Self-Review

**Spec coverage:**
- Fonts ✓ (Task 1.2) — Fraunces + Newsreader + JetBrains Mono confirmed
- Primary swap teal → ink+oxblood ✓ (Task 1.3)
- Mockups kept ✓ (Task 1.1)
- Phases on `feat/frontend-pass-1`, user tests before main ✓ (Task 6.4)
- Wordmark italic + boxed ✓ (Task 2.1)
- Theme toggle icon ✓ (Task 2.3)
- 3D plinth + cluster + camera straight-forward ✓ (Task 3.2)
- Hero text + CTAs ✓ (Task 4.1)
- Live game card ✓ (Task 4.3)
- Stats redesigned ✓ (Task 4.2)
- Other pages ✓ (Task 5.x)
- E2E + ship ✓ (Task 6.x)

**Type consistency:**
- `--font-display` referenced in `app/globals.css`, `Wordmark`, `StageOverlay`, layout — consistent
- `--scene-floor`, `--plinth-color`, `--piece-light`, `--piece-dark` referenced in `globals.css` + `HeroPiece` + `HeroScene` — consistent
- Tailwind v4 picks up custom tokens via `@theme inline { --color-X: var(--X) }` mapping; check that `text-oxblood`, `bg-bg-soft`, `border-rule` etc. resolve once `globals.css` lands.

**Known unknowns / risks:**
1. Tailwind v4 + custom token names — if `text-oxblood` etc. don't resolve, fall back to `style={{ color: "var(--oxblood)" }}` inline. Already used inline-style for headline color to avoid this risk.
2. shadcn primary now ink — buttons across the app may invert. Run preview before merging.
3. e2e selectors that use `text-zinc-*` or `bg-amber-*` will break. Search + update before final test pass.
4. Existing `e2e/landing.spec.ts` references "Narrative Chess" headline — Task 4.5 covers this.
