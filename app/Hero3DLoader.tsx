"use client";

import { Suspense, lazy } from "react";

// Use React.lazy + Suspense instead of next/dynamic({ ssr: false }).
// next/dynamic in a Next 16 + turbopack dev environment intermittently
// unmounts the dynamically loaded component on hot-reload / strict-mode
// remount, which manifested as the 3D hero flashing on then disappearing
// in `bun run dev`. The React 19 native lazy + Suspense pattern is
// stable across HMR cycles and produces the same client-only behavior
// (the import only resolves in the browser since the parent is a Client
// Component).
const Hero3D = lazy(() => import("./Hero3D"));

export function Hero3DLoader() {
  return (
    <Suspense fallback={null}>
      <Hero3D />
    </Suspense>
  );
}
