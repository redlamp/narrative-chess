"use client";

import dynamic from "next/dynamic";

// dynamic() with ssr: false must live in a Client Component.
const Hero3D = dynamic(() => import("./Hero3D"), { ssr: false });

export function Hero3DLoader() {
  return <Hero3D />;
}
