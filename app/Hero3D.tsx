"use client";

import { Canvas, type RootState } from "@react-three/fiber";
import { HeroScene } from "./HeroScene";

// Default browser behavior on `webglcontextlost` is to skip restoration,
// so calling preventDefault is required for `webglcontextrestored` to ever
// fire. Turbopack HMR + r3f's createRoot can rebind the WebGL context mid-
// cycle in dev, which manifests as a brief paint then a blank canvas. The
// listener below lets the browser hand the context back, and the restore
// handler calls invalidate so the scene repaints once the context returns.
function attachContextRecovery({ gl, invalidate }: RootState) {
  const canvas = gl.domElement;
  canvas.addEventListener("webglcontextlost", (e) => e.preventDefault());
  canvas.addEventListener("webglcontextrestored", () => invalidate());
}

export default function Hero3D() {
  return (
    <div className="absolute inset-0 z-0">
      <Canvas
        camera={{ position: [0, 1.5, 6], fov: 45 }}
        dpr={[1, 2]}
        onCreated={attachContextRecovery}
      >
        <HeroScene />
      </Canvas>
    </div>
  );
}
