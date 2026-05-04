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
          <mesh position={[0, 0.4, 0]}>
            <cylinderGeometry args={[0.22, 0.3, 0.5, 24]} />
            {mat}
          </mesh>
          <mesh position={[0, 0.78, 0]}>
            <sphereGeometry args={[0.22, 24, 24]} />
            {mat}
          </mesh>
        </>
      )}

      {kind === "rook" && (
        <>
          <mesh position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.32, 0.36, 0.7, 24]} />
            {mat}
          </mesh>
          <mesh position={[0, 0.95, 0]}>
            <cylinderGeometry args={[0.36, 0.36, 0.12, 24]} />
            {mat}
          </mesh>
          {/* Battlements: 4 small boxes */}
          {[0, 90, 180, 270].map((deg, i) => {
            const r = 0.27;
            const rad = (deg * Math.PI) / 180;
            return (
              <mesh
                key={i}
                position={[Math.cos(rad) * r, 1.07, Math.sin(rad) * r]}
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
          <mesh position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.22, 0.32, 0.6, 24]} />
            {mat}
          </mesh>
          <mesh position={[0, 0.93, 0]}>
            <sphereGeometry args={[0.27, 24, 24]} />
            {mat}
          </mesh>
          <mesh position={[0, 1.25, 0]}>
            <coneGeometry args={[0.14, 0.28, 24]} />
            {mat}
          </mesh>
        </>
      )}

      {kind === "queen" && (
        <>
          <mesh position={[0, 0.55, 0]}>
            <cylinderGeometry args={[0.25, 0.36, 0.7, 24]} />
            {mat}
          </mesh>
          <mesh position={[0, 1.0, 0]}>
            <sphereGeometry args={[0.3, 24, 24]} />
            {mat}
          </mesh>
          {/* Crown spheres */}
          {[0, 60, 120, 180, 240, 300].map((deg, i) => {
            const r = 0.2;
            const rad = (deg * Math.PI) / 180;
            return (
              <mesh key={i} position={[Math.cos(rad) * r, 1.32, Math.sin(rad) * r]}>
                <sphereGeometry args={[0.07, 12, 12]} />
                {mat}
              </mesh>
            );
          })}
        </>
      )}

      {kind === "king" && (
        <>
          <mesh position={[0, 0.55, 0]}>
            <cylinderGeometry args={[0.25, 0.36, 0.7, 24]} />
            {mat}
          </mesh>
          <mesh position={[0, 1.0, 0]}>
            <sphereGeometry args={[0.3, 24, 24]} />
            {mat}
          </mesh>
          {/* Cross on top */}
          <mesh position={[0, 1.4, 0]}>
            <boxGeometry args={[0.08, 0.32, 0.08]} />
            {mat}
          </mesh>
          <mesh position={[0, 1.4, 0]}>
            <boxGeometry args={[0.22, 0.08, 0.08]} />
            {mat}
          </mesh>
        </>
      )}
    </group>
  );
}
