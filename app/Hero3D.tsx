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
