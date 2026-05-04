---
tags:
  - domain/stack
  - status/adopted
  - origin/v2-dev
  - scope/m1-5
---

# Lesson — WebGL Context Lost in Next dev with R3F

**Date:** 2026-05-04 (M1.5 ship — Phase 8 landing page hero)

## Symptom

3D hero renders for ~200–800 ms on `bun run dev`, then the canvas blanks.
Browser console:

```
THREE.WebGLRenderer: Context Lost.
```

Production (Vercel) is unaffected — only dev. Network tab clean. No font /
asset 404s. No JS exceptions thrown to user code.

## Cause — two layers

### Layer 1: React Strict Mode double-mount disposes the GL context

In dev with `reactStrictMode: true`, React mounts every component twice and
runs the cleanup pass between mounts to surface effect bugs. R3F creates a
`WebGLRenderer` on mount and disposes it on cleanup. After the first
cleanup the GL context is gone; the second mount tries to reacquire one but
gets the lost-context state instead.

### Layer 2: Turbopack HMR module re-instantiation

Even with strict mode off, Turbopack's HMR can re-instantiate the
`HeroScene` / `Hero3D` module on file edits or fast refresh, which spawns a
new `<Canvas>` whose `createRoot` rebinds GL state and forces the previous
canvas's context lost. The browser will not auto-restore unless the
`webglcontextlost` listener calls `e.preventDefault()`.

## Fix — both layers

### `next.config.ts` — disable strict mode for dev parity

```ts
const nextConfig: NextConfig = {
  reactStrictMode: false,
};
```

Vercel prod doesn't double-mount, so production rendering is unaffected.
Turning strict mode off only changes dev behavior. The trade-off is losing
the early-warning signal for unsafe effect cleanup, which we accept on this
project (small effect surface, e2e tests + manual gates catch real bugs).

### `Hero3D.tsx` — `onCreated` recovery handler

```tsx
import { Canvas, type RootState } from "@react-three/fiber";

function attachContextRecovery({ gl, invalidate }: RootState) {
  const canvas = gl.domElement;
  canvas.addEventListener("webglcontextlost", (e) => e.preventDefault());
  canvas.addEventListener("webglcontextrestored", () => invalidate());
}

<Canvas onCreated={attachContextRecovery} ...>
```

`preventDefault` on `webglcontextlost` is the documented requirement for
the browser to attempt restoration. Without it the canvas stays blank
forever. `invalidate()` on restore forces r3f to repaint the scene once
the new context is bound.

## Diagnostic

When the symptom recurs, check the browser DevTools console for
`THREE.WebGLRenderer: Context Lost.` *without* a paired
`THREE.WebGLRenderer: Context Restored.`. The mismatch confirms the
preventDefault layer is missing or stripped.

If only Strict-Mode double-mount is at fault, the disappearance happens on
*every* mount with no edits. If only HMR is at fault, the disappearance
happens after a hot-reload edit and not on cold reload.

## Related

- `next.config.ts` — `reactStrictMode: false` with header comment
- `app/Hero3D.tsx` — `onCreated={attachContextRecovery}`
- Three.js docs on context loss: https://threejs.org/docs/#manual/en/introduction/WebGL-compatibility-check
- R3F Canvas API: https://r3f.docs.pmnd.rs/api/canvas
