"use client";

import { useEffect, useState } from "react";
import type { ThreeElements } from "@react-three/fiber";

type Props = ThreeElements["group"] & {
  kind: "rook" | "bishop" | "pawn" | "king" | "queen";
  color: "white" | "black";
};

// Reads --piece-light / --piece-dark from globals.css and re-reads
// when the html.dark class flips (next-themes toggles it).
function useThemePieceColor(color: "white" | "black") {
  const [hex, setHex] = useState(color === "white" ? "#f3e8cf" : "#2a1c12");

  useEffect(() => {
    const tok = color === "white" ? "--piece-light" : "--piece-dark";
    const read = () => {
      const v = getComputedStyle(document.documentElement).getPropertyValue(tok).trim();
      if (v) setHex(v);
    };
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, [color]);

  return hex;
}

// Geometry conventions
// - Ground (where bases rest) is at Y = 0.
// - Base spans Y = 0..0.1 (center 0.05, height 0.1).
// - Body bottoms overlap into the base by 0.05 so there's no visible seam.

export function HeroPiece({ kind, color, ...rest }: Props) {
  const pieceColor = useThemePieceColor(color);
  const mat = (
    <meshPhysicalMaterial
      color={pieceColor}
      roughness={0.42}
      metalness={0.08}
      clearcoat={0.18}
      clearcoatRoughness={0.4}
      sheen={0.3}
      sheenColor="#ffffff"
    />
  );

  return (
    <group {...rest}>
      {/* Base */}
      <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.45, 0.5, 0.1, 24]} />
        {mat}
      </mesh>

      {kind === "pawn" && (
        <>
          <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.22, 0.3, 0.5, 24]} />
            {mat}
          </mesh>
          <mesh position={[0, 0.68, 0]} castShadow receiveShadow>
            <sphereGeometry args={[0.22, 24, 24]} />
            {mat}
          </mesh>
        </>
      )}

      {kind === "rook" && (
        <>
          <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.32, 0.36, 0.7, 24]} />
            {mat}
          </mesh>
          <mesh position={[0, 0.79, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.36, 0.36, 0.12, 24]} />
            {mat}
          </mesh>
          {[0, 90, 180, 270].map((deg, i) => {
            const r = 0.27;
            const rad = (deg * Math.PI) / 180;
            return (
              <mesh
                key={i}
                position={[Math.cos(rad) * r, 0.93, Math.sin(rad) * r]}
                castShadow
                receiveShadow
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
          <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.22, 0.32, 0.6, 24]} />
            {mat}
          </mesh>
          <mesh position={[0, 0.78, 0]} castShadow receiveShadow>
            <sphereGeometry args={[0.27, 24, 24]} />
            {mat}
          </mesh>
          <mesh position={[0, 1.1, 0]} castShadow receiveShadow>
            <coneGeometry args={[0.14, 0.28, 24]} />
            {mat}
          </mesh>
        </>
      )}

      {kind === "queen" && (
        <>
          <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.25, 0.36, 0.7, 24]} />
            {mat}
          </mesh>
          <mesh position={[0, 0.85, 0]} castShadow receiveShadow>
            <sphereGeometry args={[0.3, 24, 24]} />
            {mat}
          </mesh>
          {[0, 60, 120, 180, 240, 300].map((deg, i) => {
            const r = 0.2;
            const rad = (deg * Math.PI) / 180;
            return (
              <mesh
                key={i}
                position={[Math.cos(rad) * r, 1.17, Math.sin(rad) * r]}
                castShadow
                receiveShadow
              >
                <sphereGeometry args={[0.07, 12, 12]} />
                {mat}
              </mesh>
            );
          })}
        </>
      )}

      {kind === "king" && (
        <>
          <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.25, 0.36, 0.7, 24]} />
            {mat}
          </mesh>
          <mesh position={[0, 0.85, 0]} castShadow receiveShadow>
            <sphereGeometry args={[0.3, 24, 24]} />
            {mat}
          </mesh>
          <mesh position={[0, 1.25, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.08, 0.32, 0.08]} />
            {mat}
          </mesh>
          <mesh position={[0, 1.25, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.22, 0.08, 0.08]} />
            {mat}
          </mesh>
        </>
      )}
    </group>
  );
}
