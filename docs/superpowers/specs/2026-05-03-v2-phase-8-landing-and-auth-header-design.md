# V2 Phase 8 — Landing Page + 3D Hero + Auth Header Design

**Date:** 2026-05-03
**Status:** Draft, pending implementation
**Predecessor phases:** 1–6 shipped to production; phase 7 (games directory + observer count) on `dev` awaiting prod ship.
**Companion phase:** Phase 7 — separate branch.

## 1. Context

The current `app/page.tsx` is a Next.js scaffold-default landing page with no marketing identity. M1 ships functional multiplayer chess but presents to a brand-new visitor as a generic Next app with login/sign-up links. Narrative Chess wants a memorable first impression: a 3D hero that puts the product's name front-and-centre, hints at the chess substrate, and pulls visitors directly into sign-up or login.

Phase 8 replaces the landing page with a 3D hero scene, themes the page light/dark per the spec, and adds login + sign-up affordances in the top-right corner that use modal flows over Supabase's auth pattern.

## 2. Goals

- New visitor opening `https://narrative-chess-...` lands on a styled hero with "Narrative" / "Chess" rendered in 3D on two lines, white in both modes, with low-poly chess pieces flanking the text.
- Background colour: dark grey (`zinc-900`-ish) in dark mode, amber-100 cream in light mode.
- Camera responds to mouse position with subtle parallax — closer to "scene shifts with cursor" than full orbit. Range a few degrees / a few px max.
- Top-right header has Login + Sign Up buttons. Click opens a modal with the corresponding auth flow. Auth copy + terms follow Supabase's recommended patterns.
- Existing `/login` + `/sign-up` pages keep working for deep links, redirect targets, and password-recovery flows.
- Authenticated users hitting `/` see a smaller "Continue" affordance (or skip the marketing surface entirely and bounce to `/games`). Decision: show the same hero but swap the auth header for a "Continue → /games" CTA, so signed-in users still get the brand impression once.

## 3. Non-goals

- **Marketing copy / tagline / explainer sections.** Hero only for now. Below-fold content lands separately if/when product needs it.
- **OAuth providers.** Email + password is the M1 auth surface; OAuth deferred per `wiki/notes/decision-auth-email-password.md`.
- **Animated piece movement / playthroughs in hero.** Static-but-parallaxed scene; no chess simulation.
- **Mobile-first redesign.** Desktop-first hero per existing M1 stance. Hero scales down on mobile but the parallax may degrade to no-op (touch devices have no mouse).
- **Logo / brand assets.** Title text in 3D IS the logo for now.
- **Framer Motion for non-3D animations.** GSAP handles any non-3D animation needs (e.g., modal open/close polish if needed).

## 4. Architecture

### 4.1 Files

| Path | Responsibility |
|------|----------------|
| `package.json` | Add `three`, `@react-three/fiber`, `@react-three/drei`, `gsap`, `@gsap/react`. |
| `app/page.tsx` | NEW: hero-shell server component, hydrates auth status, renders `<Hero3D>` + `<AuthHeader>`. |
| `app/page.test.tsx` (optional) | Smoke render of the page — skip if R3F SSR is brittle. |
| `app/Hero3D.tsx` | NEW: client component, R3F `<Canvas>` wrapping the scene. |
| `app/HeroScene.tsx` | NEW: client component, builds the `<group>` of text + pieces + lights. |
| `app/HeroPiece.tsx` | NEW: client component, low-poly chess-piece primitives stacked into shapes. Single component takes a `kind: "rook" | "bishop" | "pawn" | "king" | "queen"` + `color: "white" | "black"` prop. |
| `app/AuthHeader.tsx` | NEW: client component, top-right login + sign-up buttons. Mounts `<LoginDialog>` + `<SignUpDialog>`. |
| `app/LoginDialog.tsx` | NEW: client component, shadcn `<Dialog>` wrapping a reused `<LoginForm>`. |
| `app/SignUpDialog.tsx` | NEW: client component, shadcn `<Dialog>` wrapping `<SignUpForm>`. |
| `app/(auth)/login/LoginForm.tsx` | EXTRACT: pull the existing form out of `app/(auth)/login/page.tsx` so the dialog can reuse it. |
| `app/(auth)/sign-up/SignUpForm.tsx` | EXTRACT: same as login. |
| `components/ui/dialog.tsx` | NEW: shadcn-installed `<Dialog>` component. |
| `app/globals.css` | Theme background color rules — dark-grey in dark, amber-100 in light. |

### 4.2 Hero scene composition

#### Stack

- `three@latest`
- `@react-three/fiber@latest` — React renderer for Three.js.
- `@react-three/drei@latest` — helpers (we use `<Text3D>`, `<Center>`, `<PerspectiveCamera>`).
- `gsap@latest` + `@gsap/react@latest` — animations (modal entry/exit polish if needed; not strictly required for parallax).

#### Scene layout

A single `<Canvas>` mounted full-viewport-width. Inside:

- `<PerspectiveCamera makeDefault position={[0, 0, 5]} fov={45}>`.
- `<ambientLight intensity={0.4}>` + `<directionalLight position={[5, 10, 5]} intensity={1.2}>`.
- `<Center>` wrapping a `<group>` for the text:
  - `<Text3D font="/fonts/inter-bold.json" size={1} height={0.15}>Narrative</Text3D>`
  - `<Text3D font="/fonts/inter-bold.json" size={1} height={0.15} position={[0, -1.2, 0]}>Chess</Text3D>`
  - Both white (`<meshStandardMaterial color="white" roughness={0.4} metalness={0.1} />`).
- 5 chess pieces positioned around the text:
  - **Left column** (white pieces): `<HeroPiece kind="rook" color="white" position={[-3, 0.8, 0]} />`, `<HeroPiece kind="bishop" color="white" position={[-3, -0.5, 0]} />`, `<HeroPiece kind="pawn" color="white" position={[-3, -1.6, 0]} />`.
  - **Right column** (black pieces): `<HeroPiece kind="king" color="black" position={[3, 0.4, 0]} />`, `<HeroPiece kind="queen" color="black" position={[3, -1.0, 0]} />`.
  - Slight rotation per piece for visual interest.

#### `<HeroPiece>` low-poly construction

Each piece is a `<group>` of stacked Three.js primitives (`<cylinderGeometry>`, `<sphereGeometry>`, `<coneGeometry>`, `<torusGeometry>`). No external GLTF asset.

| Kind | Composition (rough) |
|---|---|
| Pawn | base cylinder (wide, short) → cylinder (tall, narrow) → sphere top |
| Rook | base cylinder → square-ish cylinder body → cylinder + 4 small box battlements top |
| Bishop | base cylinder → ovoid body (sphere stretched) → cone tip with a torus collar |
| Queen | base cylinder → tapered cylinder body → sphere → cone with 4 small spheres around (crown) |
| King | base cylinder → tapered cylinder → sphere with cylinder + cylinder cross on top |

Materials:
- White pieces: `<meshStandardMaterial color="#f4f4f5" roughness={0.55} />`.
- Black pieces: `<meshStandardMaterial color="#18181b" roughness={0.65} />`.

Implementation flexibility: the implementer can tweak proportions / add/remove sub-meshes to make the silhouettes read clearly at the camera distance. Goal is "recognizable as that piece at a glance"; perfect realism isn't required.

#### Mouse parallax

Subtle camera offset in response to mouse position relative to viewport center.

```ts
useFrame((state) => {
  const target = state.pointer; // -1..1 in both axes, world-aligned
  state.camera.position.x = MathUtils.damp(state.camera.position.x, target.x * 0.4, 4, 1/60);
  state.camera.position.y = MathUtils.damp(state.camera.position.y, target.y * 0.25, 4, 1/60);
  state.camera.lookAt(0, 0, 0);
});
```

`MathUtils.damp` smooths the response (lerp with frame-rate-independent damping). The 0.4 / 0.25 multipliers cap the offset at small values so the effect is "scene shifts a few units" rather than "scene rotates".

On touch devices (`pointer: coarse`): skip the parallax entirely. Detect via media query and conditionally mount the `useFrame` hook.

### 4.3 Theming

#### Background

`app/page.tsx` (or `app/globals.css`) sets the page background:

- Light mode: `bg-amber-100` (Tailwind) → cream.
- Dark mode: `bg-zinc-900` → dark grey.

The `<Canvas>` background is transparent so the page background shows through.

#### Text colour

White (`#fafafa` or `#fff`) in both modes — explicit in `<meshStandardMaterial color>`. Lighting tuned so white reads correctly against both backgrounds (ambient + directional balance).

### 4.4 Auth modals

#### `<Dialog>` install

```bash
bunx shadcn@latest add dialog
```

Generates `components/ui/dialog.tsx` (Radix `<Dialog>` wrapped in shadcn styles).

#### `<LoginForm>` / `<SignUpForm>` extraction

Existing pages live at `app/(auth)/login/page.tsx` and `app/(auth)/sign-up/page.tsx`. They each contain a server-action-driven form. Extract the JSX into `LoginForm.tsx` / `SignUpForm.tsx` client components that take `onSuccess` callback (defaults to `router.push('/games')`). Both pages then mount `<LoginForm />` / `<SignUpForm />` directly. The dialog versions mount them inside a `<DialogContent>`.

#### Dialog terms / copy

Match Supabase's auth-ui defaults:

- Login dialog title: "Sign in" (matches Supabase's "Sign in" not "Log in").
- Sign-up dialog title: "Sign up".
- Form fields: "Email" + "Password".
- Submit button: "Sign in" / "Sign up".
- Footer link: "Don't have an account? Sign up" / "Already have an account? Sign in" — clicking swaps the dialog content.

For seamless swap: a single `<AuthDialog>` shell with internal `mode: "signin" | "signup"` state could be cleaner than two separate dialogs. Going with that — `<AuthDialog>` + the `<LoginForm>` / `<SignUpForm>` slot inside.

#### Header buttons

`<AuthHeader>` renders for unauthenticated viewers as:

```tsx
<header className="fixed top-4 right-4 z-10 flex items-center gap-2">
  <Button variant="ghost" onClick={() => openAuth("signin")}>Sign in</Button>
  <Button onClick={() => openAuth("signup")}>Sign up</Button>
</header>
```

For authenticated viewers:

```tsx
<header className="fixed top-4 right-4 z-10">
  <Button asChild>
    <Link href="/games">Continue</Link>
  </Button>
</header>
```

### 4.5 Page hydration

`app/page.tsx` is a server component:

```tsx
export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <main className="min-h-screen bg-amber-100 dark:bg-zinc-900 relative overflow-hidden">
      <AuthHeader authed={!!user} />
      <Hero3D />
    </main>
  );
}
```

`<Hero3D>` is `'use client'` to host the R3F `<Canvas>`. `<AuthHeader>` is also client (it owns dialog state).

### 4.6 Performance + bundle

R3F + Three.js + Drei = ~250kB gzipped. Significant for a landing page. Mitigations:

- Use `next/dynamic` to import `<Hero3D>` with `ssr: false` so the canvas doesn't try to render on the server.
- Code-split: `<Hero3D>` is the only consumer of three/r3f/drei. Other pages don't pay the cost.
- Optimize the typeface.json: ship only the glyphs we need (Narrative, Chess — 11 unique characters). A trimmed font file is ~5–10kB instead of ~80kB.

GSAP is small (~30kB). Only used if we add modal-entry polish; otherwise drop it.

## 5. Testing

### 5.1 Unit (Bun)

- Skip — R3F + jsdom is brittle. Manual smoke covers the visual.

### 5.2 E2E (Playwright)

- `e2e/landing.spec.ts` (optional) — navigate to `/`, assert the page renders without console errors, find Sign In + Sign Up buttons, click Sign In → assert dialog opens. Don't try to assert 3D content.

### 5.3 Manual smoke

- Open `/` in light mode → cream background + white text + 5 pieces.
- Open `/` in dark mode → dark-grey background + white text + 5 pieces.
- Move mouse → scene shifts subtly.
- Click Sign Up → dialog opens. Sign up new account. Land on `/games`.
- Click Sign In with existing creds → dialog opens. Sign in. Land on `/games`.
- Visit `/` while authed → "Continue" button (no Sign In/Up).
- Resize to mobile width → hero scales / parallax disables on touch.

### 5.4 Verification gate

- `bun run lint`
- `bunx tsc --noEmit`
- `bun test`
- `bunx playwright test`
- `supabase db lint`
- Manual smoke (above)

## 6. Risks + open implementation-time questions

- **Font asset for `<Text3D>`**: Drei's `<Text3D>` wants a `typeface.json` file. We can use the Three.js stock `helvetiker_regular.typeface.json` shipped with Three's examples, or generate a custom one from Inter via `https://gero3.github.io/facetype.js/`. Trimmed-glyph font keeps bundle small. Decide at implementation time.
- **Mobile parallax**: spec defers, but watch for performance on lower-end mobile — R3F + many lights = heat. If FPS tanks on mobile, swap parallax for a static scene + remove `useFrame`.
- **Auth dialog vs page redirect on form errors**: existing form-driven pages redirect on success and show error toast on failure. The dialog version needs to render error states inline (inside the dialog). The extracted form components must accept an `onError` callback or expose error state.
- **Dialog accessibility**: shadcn `<Dialog>` is Radix-based, which handles focus trapping + escape-to-close + ARIA. No additional work expected.
- **`<Hero3D>` SSR**: R3F is client-only; wrap in `next/dynamic` with `ssr: false`. Without that, the build hits "window is not defined" on prerender.
- **WebGL context loss on tab switch**: rare but possible. R3F's default `<Canvas>` recovers. If we see issues, add `<Canvas onCreated>` reset logic.

## 7. References

- Phase 5 design (sets the React 19 + shadcn baseline): `docs/superpowers/specs/2026-05-03-v2-phase-5-board-realtime-design.md`.
- Decision: email + password auth: `wiki/notes/decision-auth-email-password.md`.
- Decision: stack: `wiki/notes/decision-stack-nextjs-16.md`.
- React Three Fiber docs: https://r3f.docs.pmnd.rs
- Drei docs: https://drei.docs.pmnd.rs
- shadcn `<Dialog>`: https://ui.shadcn.com/docs/components/dialog
