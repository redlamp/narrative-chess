# V2 Phase 8 — Landing Page + 3D Hero + Auth Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Replace the scaffold-default landing page with a 3D hero scene featuring "Narrative" / "Chess" extruded text plus low-poly chess pieces, parallax-on-mouse, themed light/dark, and top-right Sign In + Sign Up buttons that open modal dialogs reusing the existing auth forms.

**Architecture:** Server component `app/page.tsx` hydrates auth state and renders `<AuthHeader>` + `<Hero3D>`. Hero3D is dynamically imported with `ssr: false` (R3F is client-only). Hero scene is built with Three.js + R3F + Drei (`<Text3D>`, `<Center>`) + custom `<HeroPiece>` for low-poly chess pieces. Mouse parallax via `useFrame` damping camera position. Auth modals via shadcn `<Dialog>` wrapping forms extracted from existing `/login` + `/sign-up` pages.

**Tech Stack:** Next.js 16 Server Components, React 19, three, @react-three/fiber, @react-three/drei, gsap + @gsap/react (animation polish), shadcn dialog, existing Supabase auth.

**Spec reference:** `docs/superpowers/specs/2026-05-03-v2-phase-8-landing-and-auth-header-design.md`.

**Prerequisites (M1 must be shipped + phase 7 on dev):** Phases 1–7 on `dev`. Auth UI at `/login` + `/sign-up` exists.

**Working branch:** `feat/phase-8-landing-and-auth-header` off `dev` (already created).

---

## Subagent dispatch guidance

Phase 8 is UI-surface work without subtle correctness invariants. No Opus-tier tasks; the heaviest lifts are visual / 3D scene composition.

| # | Task | Model | Effort | Why |
|---|------|-------|--------|-----|
| 1 | Branch off dev | Haiku | low | git only (already done) |
| 2 | Install deps (three, R3F, Drei, GSAP, gsap-react) + shadcn dialog | Haiku | low | CLI only |
| 3 | Add font asset (Inter trimmed to needed glyphs OR helvetiker fallback) | Sonnet | low | one file, one decision |
| 4 | Extract `<LoginForm>` + `<SignUpForm>` from existing /login + /sign-up pages | Sonnet | standard | refactor; existing pages must keep working |
| 5 | `<AuthDialog>` (single shell with mode=signin/signup) | Sonnet | standard | new client component + Radix Dialog wiring |
| 6 | `<AuthHeader>` (top-right buttons; opens dialog OR Continue link if authed) | Sonnet | low | client component |
| 7 | `<HeroPiece>` low-poly chess pieces | Sonnet | standard | five piece shapes from primitives, proportion tuning |
| 8 | `<HeroScene>` — text + pieces + lights + parallax useFrame | Sonnet | standard | scene composition, mouse parallax with damp |
| 9 | `<Hero3D>` Canvas wrapper + dynamic import in page | Sonnet | low | R3F Canvas + next/dynamic ssr=false |
| 10 | Theme `app/page.tsx` (bg-amber-100 dark:bg-zinc-900) + mount header + hero | Sonnet | low | top-level layout |
| 11 | (Optional) `e2e/landing.spec.ts` smoke | Sonnet | low | renders, dialogs open |
| 12 | Verification gate | Haiku | low | runs lint / tsc / playwright / supabase db lint |
| 13 | Open PR feat → dev | Haiku | low | git push + gh pr create |

13 tasks total, distribution: 4 Haiku, 9 Sonnet, 0 Opus.

**BLOCKED escalation rule**: first retry escalates one tier. Bump GameClient-style heavy state stuff to Opus only if a task returns BLOCKED with an unresolved correctness issue.

---

## File structure

| Path | Responsibility |
|------|----------------|
| `package.json` + `bun.lock` | new deps |
| `public/fonts/inter-bold.json` (or similar) | typeface.json font asset for `<Text3D>` |
| `components/ui/dialog.tsx` | shadcn-installed Dialog |
| `app/(auth)/login/LoginForm.tsx` | NEW — extracted from existing page |
| `app/(auth)/sign-up/SignUpForm.tsx` | NEW — extracted |
| `app/(auth)/login/page.tsx` | UPDATED — uses LoginForm |
| `app/(auth)/sign-up/page.tsx` | UPDATED — uses SignUpForm |
| `app/AuthDialog.tsx` | NEW — single dialog shell, mode swap |
| `app/AuthHeader.tsx` | NEW — top-right buttons / Continue link |
| `app/HeroPiece.tsx` | NEW — low-poly chess piece component |
| `app/HeroScene.tsx` | NEW — text + pieces + lights + parallax |
| `app/Hero3D.tsx` | NEW — Canvas wrapper |
| `app/page.tsx` | UPDATED — auth-aware + mounts header + Hero3D |
| `e2e/landing.spec.ts` | NEW (optional) |

---

## Tasks

### Task 1: Branch off dev

**Subagent:** Haiku · low effort

**Files:** none.

- [x] Already done: `feat/phase-8-landing-and-auth-header` checked out from `dev`.

---

### Task 2: Install deps

**Subagent:** Haiku · low effort

**Files:**
- Modify: `package.json`, `bun.lock`
- Create: `components/ui/dialog.tsx`

- [ ] **Step 1: Install Three.js + R3F + Drei + GSAP**

```bash
bun add three @react-three/fiber @react-three/drei gsap @gsap/react
bun add -d @types/three
```

- [ ] **Step 2: Install shadcn dialog**

```bash
bunx shadcn@latest add dialog
```

- [ ] **Step 3: Verify**

```bash
bunx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add package.json bun.lock components/ui/dialog.tsx
git commit -m "chore(deps): three + R3F + drei + GSAP + shadcn dialog"
```

---

### Task 3: Font asset for `<Text3D>`

**Subagent:** Sonnet · low effort

**Files:**
- Create: `public/fonts/<name>.typeface.json`

Two paths — pick one based on what's easier:

**Path A — use Three.js stock helvetiker font:**
- Download `https://threejs.org/examples/fonts/helvetiker_bold.typeface.json` to `public/fonts/helvetiker_bold.typeface.json`.
- Reference in `<Text3D font="/fonts/helvetiker_bold.typeface.json">`.
- Bundle: ~80kB.

**Path B — trim Inter to needed glyphs:**
- Use `https://gero3.github.io/facetype.js/` to convert Inter Bold (or equivalent geometric sans) to typeface.json.
- Trim glyphs to: `N a r t i v e C h s` (10 unique characters; remove duplicates of letters across "Narrative" + "Chess").
- Bundle: ~10–20kB.

Recommend **Path A** for first cut (faster, no manual font-trimming). Path B is a polish item if bundle size matters.

- [ ] **Step 1: Add font file** (download or generate per path).
- [ ] **Step 2: Commit**

```bash
git add public/fonts/<name>.typeface.json
git commit -m "chore(assets): typeface.json font asset for hero 3D text"
```

---

### Task 4: Extract LoginForm + SignUpForm

**Subagent:** Sonnet · standard effort

**Files:**
- Create: `app/(auth)/login/LoginForm.tsx`
- Create: `app/(auth)/sign-up/SignUpForm.tsx`
- Modify: `app/(auth)/login/page.tsx`
- Modify: `app/(auth)/sign-up/page.tsx`

Read existing `app/(auth)/login/page.tsx` and `app/(auth)/sign-up/page.tsx`. Extract the form JSX + the form-submit logic into a client component file. The page keeps its server-side layout shell (auth gate, redirect-if-already-logged-in, etc.) and renders the form component.

The extracted forms accept an optional `onSuccess?: () => void` prop that defaults to `router.push("/games")`. The dialog versions (Task 5) override this with `() => setOpen(false); router.push(redirectTarget ?? "/games")`.

- [ ] **Step 1: Read existing pages.**
- [ ] **Step 2: Extract** to `LoginForm.tsx` and `SignUpForm.tsx`. Both `'use client'`.
- [ ] **Step 3: Update existing pages** to render the forms.
- [ ] **Step 4: Manual smoke** — `/login` + `/sign-up` still work end-to-end.
- [ ] **Step 5: Typecheck + lint.**
- [ ] **Step 6: Commit**

```bash
git add app/(auth)
git commit -m "refactor(auth): extract LoginForm + SignUpForm for dialog reuse"
```

---

### Task 5: AuthDialog component

**Subagent:** Sonnet · standard effort

**Files:**
- Create: `app/AuthDialog.tsx`

Single dialog shell with internal `mode: "signin" | "signup"` state. Imports `<LoginForm>` + `<SignUpForm>` and shows the right one. Footer link swaps mode without closing the dialog.

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { LoginForm } from "./(auth)/login/LoginForm";
import { SignUpForm } from "./(auth)/sign-up/SignUpForm";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMode?: "signin" | "signup";
};

export function AuthDialog({ open, onOpenChange, initialMode = "signin" }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);

  const onSuccess = () => {
    onOpenChange(false);
    router.push("/games");
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{mode === "signin" ? "Sign in" : "Sign up"}</DialogTitle>
          <DialogDescription>
            {mode === "signin"
              ? "Welcome back. Sign in to continue."
              : "Create an account to start playing."}
          </DialogDescription>
        </DialogHeader>
        {mode === "signin" ? (
          <LoginForm onSuccess={onSuccess} />
        ) : (
          <SignUpForm onSuccess={onSuccess} />
        )}
        <p className="text-xs text-center text-muted-foreground">
          {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
          <button
            type="button"
            className="underline"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] Write the file.
- [ ] Typecheck + lint.
- [ ] Commit:

```bash
git add app/AuthDialog.tsx
git commit -m "feat(phase 8): AuthDialog — sign in / sign up modal with mode swap"
```

---

### Task 6: AuthHeader component

**Subagent:** Sonnet · low effort

**Files:**
- Create: `app/AuthHeader.tsx`

Top-right header. Two states based on `authed: boolean` prop:

- **Authed:** single `<Continue → /games>` button.
- **Not authed:** `<Sign in>` + `<Sign up>` buttons; opens `<AuthDialog>` with the right mode.

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AuthDialog } from "./AuthDialog";

type Props = { authed: boolean };

export function AuthHeader({ authed }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  if (authed) {
    return (
      <header className="absolute top-4 right-4 z-10">
        <Button asChild>
          <Link href="/games">Continue</Link>
        </Button>
      </header>
    );
  }

  return (
    <>
      <header className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <Button
          variant="ghost"
          onClick={() => {
            setMode("signin");
            setOpen(true);
          }}
        >
          Sign in
        </Button>
        <Button
          onClick={() => {
            setMode("signup");
            setOpen(true);
          }}
        >
          Sign up
        </Button>
      </header>
      <AuthDialog open={open} onOpenChange={setOpen} initialMode={mode} />
    </>
  );
}
```

- [ ] Write + typecheck + lint + commit:

```bash
git add app/AuthHeader.tsx
git commit -m "feat(phase 8): AuthHeader — top-right Sign in / Sign up / Continue"
```

---

### Task 7: HeroPiece component

**Subagent:** Sonnet · standard effort

**Files:**
- Create: `app/HeroPiece.tsx`

Low-poly chess piece via stacked Three.js primitives. Single component, `kind: "rook" | "bishop" | "pawn" | "king" | "queen"`, `color: "white" | "black"`, accepts `position`, `rotation`, `scale` props.

Build each piece as a small group of primitives. Reasonable proportions (tweak in iteration):

```tsx
"use client";

import { GroupProps } from "@react-three/fiber";

type Props = GroupProps & {
  kind: "rook" | "bishop" | "pawn" | "king" | "queen";
  color: "white" | "black";
};

const COLORS = {
  white: "#f4f4f5",
  black: "#18181b",
};

export function HeroPiece({ kind, color, ...rest }: Props) {
  const mat = (
    <meshStandardMaterial color={COLORS[color]} roughness={0.55} metalness={0.05} />
  );

  return (
    <group {...rest}>
      {/* Base — every piece has one */}
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.45, 0.5, 0.1, 24]} />
        {mat}
      </mesh>

      {kind === "pawn" && (
        <>
          <mesh position={[0, 0.4, 0]}>
            <cylinderGeometry args={[0.22, 0.3, 0.5, 24]} />
            {mat}
          </mesh>
          <mesh position={[0, 0.78, 0]}>
            <sphereGeometry args={[0.22, 24, 24]} />
            {mat}
          </mesh>
        </>
      )}

      {kind === "rook" && (
        <>
          <mesh position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.32, 0.36, 0.7, 24]} />
            {mat}
          </mesh>
          <mesh position={[0, 0.95, 0]}>
            <cylinderGeometry args={[0.36, 0.36, 0.12, 24]} />
            {mat}
          </mesh>
          {/* Battlements: 4 small boxes */}
          {[0, 90, 180, 270].map((deg, i) => {
            const r = 0.27;
            const rad = (deg * Math.PI) / 180;
            return (
              <mesh
                key={i}
                position={[Math.cos(rad) * r, 1.07, Math.sin(rad) * r]}
              >
                <boxGeometry args={[0.12, 0.16, 0.12]} />
                {mat}
              </mesh>
            );
          })}
        </>
      )}

      {kind === "bishop" && (
        <>
          <mesh position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.22, 0.32, 0.6, 24]} />
            {mat}
          </mesh>
          <mesh position={[0, 0.93, 0]}>
            <sphereGeometry args={[0.27, 24, 24]} />
            {mat}
          </mesh>
          <mesh position={[0, 1.25, 0]}>
            <coneGeometry args={[0.14, 0.28, 24]} />
            {mat}
          </mesh>
        </>
      )}

      {kind === "queen" && (
        <>
          <mesh position={[0, 0.55, 0]}>
            <cylinderGeometry args={[0.25, 0.36, 0.7, 24]} />
            {mat}
          </mesh>
          <mesh position={[0, 1.0, 0]}>
            <sphereGeometry args={[0.3, 24, 24]} />
            {mat}
          </mesh>
          {/* Crown spheres */}
          {[0, 60, 120, 180, 240, 300].map((deg, i) => {
            const r = 0.2;
            const rad = (deg * Math.PI) / 180;
            return (
              <mesh key={i} position={[Math.cos(rad) * r, 1.32, Math.sin(rad) * r]}>
                <sphereGeometry args={[0.07, 12, 12]} />
                {mat}
              </mesh>
            );
          })}
        </>
      )}

      {kind === "king" && (
        <>
          <mesh position={[0, 0.55, 0]}>
            <cylinderGeometry args={[0.25, 0.36, 0.7, 24]} />
            {mat}
          </mesh>
          <mesh position={[0, 1.0, 0]}>
            <sphereGeometry args={[0.3, 24, 24]} />
            {mat}
          </mesh>
          {/* Cross on top */}
          <mesh position={[0, 1.4, 0]}>
            <boxGeometry args={[0.08, 0.32, 0.08]} />
            {mat}
          </mesh>
          <mesh position={[0, 1.4, 0]}>
            <boxGeometry args={[0.22, 0.08, 0.08]} />
            {mat}
          </mesh>
        </>
      )}
    </group>
  );
}
```

Implementer: tweak proportions for visual balance against text size 1. The shapes above are starting points.

- [ ] Write + typecheck + lint + commit:

```bash
git add app/HeroPiece.tsx
git commit -m "feat(phase 8): HeroPiece — low-poly chess pieces from Three primitives"
```

---

### Task 8: HeroScene + parallax

**Subagent:** Sonnet · standard effort

**Files:**
- Create: `app/HeroScene.tsx`

Scene composition:

```tsx
"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Center, Text3D } from "@react-three/drei";
import { MathUtils, Group } from "three";
import { HeroPiece } from "./HeroPiece";

const FONT_URL = "/fonts/helvetiker_bold.typeface.json";

export function HeroScene() {
  const cameraRef = useRef<{ position: { x: number; y: number; z: number } } | null>(
    null,
  );

  useFrame((state) => {
    const target = state.pointer;
    state.camera.position.x = MathUtils.damp(
      state.camera.position.x,
      target.x * 0.4,
      4,
      1 / 60,
    );
    state.camera.position.y = MathUtils.damp(
      state.camera.position.y,
      target.y * 0.25,
      4,
      1 / 60,
    );
    state.camera.lookAt(0, 0, 0);
  });

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 10, 5]} intensity={1.2} />

      {/* Title — two lines, white in both modes */}
      <Center disableY>
        <group>
          <Text3D font={FONT_URL} size={1} height={0.15} position={[0, 0.6, 0]}>
            Narrative
            <meshStandardMaterial color="white" roughness={0.4} metalness={0.1} />
          </Text3D>
          <Text3D font={FONT_URL} size={1} height={0.15} position={[0, -0.7, 0]}>
            Chess
            <meshStandardMaterial color="white" roughness={0.4} metalness={0.1} />
          </Text3D>
        </group>
      </Center>

      {/* Left: white pieces */}
      <HeroPiece kind="rook" color="white" position={[-3.2, 0.8, 0]} rotation={[0, 0.2, 0]} />
      <HeroPiece kind="bishop" color="white" position={[-3.4, -0.5, 0]} rotation={[0, -0.3, 0]} />
      <HeroPiece kind="pawn" color="white" position={[-3.0, -1.6, 0]} rotation={[0, 0.1, 0]} />

      {/* Right: black pieces */}
      <HeroPiece kind="king" color="black" position={[3.2, 0.4, 0]} rotation={[0, -0.2, 0]} />
      <HeroPiece kind="queen" color="black" position={[3.4, -1.0, 0]} rotation={[0, 0.3, 0]} />
    </>
  );
}
```

- [ ] Write + typecheck + lint + commit:

```bash
git add app/HeroScene.tsx
git commit -m "feat(phase 8): HeroScene — text + pieces + parallax camera"
```

---

### Task 9: Hero3D Canvas wrapper

**Subagent:** Sonnet · low effort

**Files:**
- Create: `app/Hero3D.tsx`

```tsx
"use client";

import { Canvas } from "@react-three/fiber";
import { HeroScene } from "./HeroScene";

export default function Hero3D() {
  return (
    <div className="absolute inset-0 z-0">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 45 }}
        dpr={[1, 2]}
      >
        <HeroScene />
      </Canvas>
    </div>
  );
}
```

(Note: `default export` so `next/dynamic` can import without named-exports plumbing.)

- [ ] Write + typecheck + lint + commit:

```bash
git add app/Hero3D.tsx
git commit -m "feat(phase 8): Hero3D — Canvas wrapper for HeroScene"
```

---

### Task 10: Update app/page.tsx

**Subagent:** Sonnet · low effort

**Files:**
- Modify: `app/page.tsx`

Replace the existing Next-scaffold landing with:

```tsx
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/server";
import { AuthHeader } from "./AuthHeader";

const Hero3D = dynamic(() => import("./Hero3D"), { ssr: false });

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="relative min-h-screen overflow-hidden bg-amber-100 dark:bg-zinc-900">
      <AuthHeader authed={!!user} />
      <Hero3D />
    </main>
  );
}
```

(Remove the existing scaffold content. If there's anything from the previous landing worth preserving — links, footer text — port it forward; otherwise start clean.)

- [ ] Read existing `app/page.tsx`.
- [ ] Replace per above.
- [ ] Manual smoke: `bun run dev` → `/` shows hero with text + pieces; light/dark toggle changes background; click Sign in / Sign up → modals open.
- [ ] Typecheck + lint.
- [ ] Commit:

```bash
git add app/page.tsx
git commit -m "feat(phase 8): wire 3D hero + auth header into landing page"
```

---

### Task 11: E2E landing smoke (optional)

**Subagent:** Sonnet · low effort

**Files:**
- Create: `e2e/landing.spec.ts`

Light smoke — page loads without console errors, Sign in + Sign up buttons present, click → modal opens. Don't try to assert on 3D content (unstable in headless).

```ts
import { test, expect } from "@playwright/test";

test("landing renders auth header", async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/`);
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /sign up/i })).toBeVisible();

  await page.getByRole("button", { name: /sign up/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("heading", { name: /sign up/i })).toBeVisible();
});
```

- [ ] Write + run + commit:

```bash
git add e2e/landing.spec.ts
git commit -m "test(phase 8): e2e landing — auth header + dialog opens"
```

---

### Task 12: Verification gate

**Subagent:** Haiku · low effort

- [ ] `bun run lint`
- [ ] `bunx tsc --noEmit`
- [ ] `bun test`
- [ ] `bunx playwright test`
- [ ] `supabase db lint`
- [ ] Manual smoke (light + dark + parallax + auth dialogs + Continue link if authed)

---

### Task 13: Open PR feat → dev

**Subagent:** Haiku · low effort

```bash
git push -u origin feat/phase-8-landing-and-auth-header
gh pr create --base dev --head feat/phase-8-landing-and-auth-header \
  --title "feat: Phase 8 — landing page + 3D hero + auth header" \
  --body "..."
```

Wait for CI green + manual smoke → squash-merge.
