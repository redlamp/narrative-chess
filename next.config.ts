import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // R3F + Next 16 turbopack: strict-mode double-mount disposes the
  // WebGLRenderer's GL context on the first cleanup pass, and the
  // second mount fails to reacquire it ("THREE.WebGLRenderer: Context
  // Lost."). Vercel production doesn't strict-double-mount, so the
  // hero renders fine there. Off here for dev parity.
  reactStrictMode: false,
};

export default nextConfig;
