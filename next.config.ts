import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Layer 1 of the dev "hero disappears" fix. Strict-mode double-mount
  // disposes the WebGLRenderer's GL context on the first cleanup pass.
  // Layer 2 lives in app/Hero3D.tsx (webglcontextlost preventDefault +
  // webglcontextrestored invalidate). Both are needed; see
  // wiki/notes/lesson-webgl-strict-mode-context-loss.md.
  reactStrictMode: false,
};

export default nextConfig;
