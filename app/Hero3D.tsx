"use client";

import { Canvas, type RootState } from "@react-three/fiber";
import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace } from "three";
import { Environment } from "@react-three/drei";
import { HeroScene } from "./HeroScene";

// Default browser behavior on `webglcontextlost` is to skip restoration,
// so calling preventDefault is required for `webglcontextrestored` to
// ever fire. Turbopack HMR + r3f's createRoot can rebind the WebGL
// context mid-cycle in dev, which manifests as a brief paint then a
// blank canvas.
function attachContextRecovery({ gl, invalidate }: RootState) {
  const canvas = gl.domElement;
  canvas.addEventListener("webglcontextlost", (e) => e.preventDefault());
  canvas.addEventListener("webglcontextrestored", () => invalidate());
}

export default function Hero3D() {
  return (
    <div className="absolute inset-0 z-0 pointer-events-none">
      <Canvas
        camera={{ position: [0, 1.7, 7.5], fov: 36 }}
        dpr={[1, 2]}
        shadows
        gl={{ antialias: true, alpha: true }}
        onCreated={(state) => {
          state.gl.shadowMap.enabled = true;
          state.gl.shadowMap.type = PCFSoftShadowMap;
          state.gl.outputColorSpace = SRGBColorSpace;
          state.gl.toneMapping = ACESFilmicToneMapping;
          state.gl.toneMappingExposure = 1.05;
          attachContextRecovery(state);
        }}
      >
        <Environment preset="apartment" environmentIntensity={0.4} />
        <HeroScene />
      </Canvas>
    </div>
  );
}
