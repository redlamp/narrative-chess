"use client";

import type { ThreeElements } from "@react-three/fiber";

type Props = ThreeElements["group"] & {
  kind: "rook" | "bishop" | "pawn" | "king" | "queen";
  color: "white" | "black";
};

const COLORS = {
  white: "#f4f4f5",
  black: "#18181b",
};

// Geometry conventions for this component
// - Ground (where bases rest) is at Y = 0.
// - Base spans Y = 0..0.1 (center 0.05, height 0.1).
// - Body bottoms overlap into the base by 0.05 so there's no visible seam.

export function HeroPiece({ kind, color, ...rest }: Props) {
  const mat = (
    <meshStandardMaterial color={COLORS[color]} roughness={0.55} metalness={0.05} />
  );

  return (
    <group {...rest}>
      {/* Base — every piece has one */}
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.45, 0.5, 0.1, 24]} />
        {mat}
      </mesh>

      {kind === "pawn" && (
        <>
          {/* body H=0.5 → bottom = 0.30 - 0.25 = 0.05 (overlaps base) */}
          <mesh position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.22, 0.3, 0.5, 24]} />
            {mat}
          </mesh>
          <mesh position={[0, 0.68, 0]}>
            <sphereGeometry args={[0.22, 24, 24]} />
            {mat}
          </mesh>
        </>
      )}

      {kind === "rook" && (
        <>
          {/* body H=0.7 → bottom = 0.40 - 0.35 = 0.05; top = 0.75 */}
          <mesh position={[0, 0.4, 0]}>
            <cylinderGeometry args={[0.32, 0.36, 0.7, 24]} />
            {mat}
          </mesh>
          {/* top cap H=0.12 — center at 0.79 → cap spans 0.73..0.85 so its
              bottom overlaps the body top by 0.02, sealing the seam. */}
          <mesh position={[0, 0.79, 0]}>
            <cylinderGeometry args={[0.36, 0.36, 0.12, 24]} />
            {mat}
          </mesh>
          {/* Battlements: 4 small boxes resting on top of the cap (top of
              cap at 0.85; box H=0.16 → center at 0.93). */}
          {[0, 90, 180, 270].map((deg, i) => {
            const r = 0.27;
            const rad = (deg * Math.PI) / 180;
            return (
              <mesh
                key={i}
                position={[Math.cos(rad) * r, 0.93, Math.sin(rad) * r]}
              >
                <boxGeometry args={[0.12, 0.16, 0.12]} />
                {mat}
              </mesh>
            );
          })}
        </>
      )}

      {kind === "bishop" && (
        <>
          {/* body H=0.6 → bottom = 0.35 - 0.30 = 0.05 */}
          <mesh position={[0, 0.35, 0]}>
            <cylinderGeometry args={[0.22, 0.32, 0.6, 24]} />
            {mat}
          </mesh>
          <mesh position={[0, 0.78, 0]}>
            <sphereGeometry args={[0.27, 24, 24]} />
            {mat}
          </mesh>
          <mesh position={[0, 1.1, 0]}>
            <coneGeometry args={[0.14, 0.28, 24]} />
            {mat}
          </mesh>
        </>
      )}

      {kind === "queen" && (
        <>
          {/* body H=0.7 → bottom = 0.40 - 0.35 = 0.05 */}
          <mesh position={[0, 0.4, 0]}>
            <cylinderGeometry args={[0.25, 0.36, 0.7, 24]} />
            {mat}
          </mesh>
          <mesh position={[0, 0.85, 0]}>
            <sphereGeometry args={[0.3, 24, 24]} />
            {mat}
          </mesh>
          {/* Crown spheres */}
          {[0, 60, 120, 180, 240, 300].map((deg, i) => {
            const r = 0.2;
            const rad = (deg * Math.PI) / 180;
            return (
              <mesh key={i} position={[Math.cos(rad) * r, 1.17, Math.sin(rad) * r]}>
                <sphereGeometry args={[0.07, 12, 12]} />
                {mat}
              </mesh>
            );
          })}
        </>
      )}

      {kind === "king" && (
        <>
          {/* body H=0.7 → bottom = 0.40 - 0.35 = 0.05 */}
          <mesh position={[0, 0.4, 0]}>
            <cylinderGeometry args={[0.25, 0.36, 0.7, 24]} />
            {mat}
          </mesh>
          <mesh position={[0, 0.85, 0]}>
            <sphereGeometry args={[0.3, 24, 24]} />
            {mat}
          </mesh>
          {/* Cross on top */}
          <mesh position={[0, 1.25, 0]}>
            <boxGeometry args={[0.08, 0.32, 0.08]} />
            {mat}
          </mesh>
          <mesh position={[0, 1.25, 0]}>
            <boxGeometry args={[0.22, 0.08, 0.08]} />
            {mat}
          </mesh>
        </>
      )}
    </group>
  );
}
