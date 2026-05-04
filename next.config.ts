import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Layer 1 of the dev "hero disappears" fix. Strict-mode double-mount
  // disposes the WebGLRenderer's GL context on the first cleanup pass.
  // Layer 2 lives in app/Hero3D.tsx (webglcontextlost preventDefault +
  // webglcontextrestored invalidate). Both are needed; see
  // wiki/notes/lesson-webgl-strict-mode-context-loss.md.
  reactStrictMode: false,

  // Expose VERCEL_ENV to the client bundle so dev-only UI (e.g. the
  // fool's-mate smoke button) can gate on "production" vs "preview"
  // vs local "development". On Vercel, NODE_ENV is "production" for
  // BOTH production and preview builds, which is why a NODE_ENV gate
  // hides dev tools from previews — exactly where we want them visible.
  // Next inlines NEXT_PUBLIC_* at build time, so the gate is still
  // statically replaceable and dead-code-eliminated in production builds.
  env: {
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV ?? "development",
  },
};

export default nextConfig;
