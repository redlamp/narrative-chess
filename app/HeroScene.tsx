"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { MathUtils } from "three";
import * as THREE from "three";
import { HeroPiece } from "./HeroPiece";

// Plinth dimensions and world position. PLINTH.x is the horizontal anchor
// for the cluster — pulled into the right third of the visible stage by
// camera frustum geometry (camera looks straight forward at origin, so a
// positive PLINTH.x naturally lands on the right side of the frame).
const PLINTH = { x: 1.24, y: 0.5, z: 0, w: 3.0, h: 1.0, d: 1.6 };
const PLINTH_TOP = PLINTH.y + PLINTH.h / 2;

// 5-piece cluster — back row taller (bishop / king / queen), front row
// shorter (pawn / rook). Centres ≥ 1.0 apart so bases don't intersect.
const LAYOUT = [
  { kind: "bishop", color: "white", x: -1.10, z: -0.45, ry: 0.30 },
  { kind: "king",   color: "white", x:  0.00, z: -0.45, ry: 0.00 },
  { kind: "queen",  color: "black", x:  1.10, z: -0.45, ry: -0.20 },
  { kind: "pawn",   color: "white", x: -0.55, z:  0.55, ry: 0.20 },
  { kind: "rook",   color: "black", x:  0.55, z:  0.55, ry: -0.40 },
] as const;

const TILT_DIVISOR = 25;

type Tilt = { x: number; y: number; active: boolean };

function useSceneTokens() {
  const [tokens, setTokens] = useState({
    floor: "#ddcca0",
    plinth: "#5a4128",
    fog: "#e8dcc4",
  });
  useEffect(() => {
    const read = () => {
      const cs = getComputedStyle(document.documentElement);
      setTokens({
        floor: cs.getPropertyValue("--scene-floor").trim() || "#ddcca0",
        plinth: cs.getPropertyValue("--plinth-color").trim() || "#5a4128",
        fog: cs.getPropertyValue("--scene-fog").trim() || "#e8dcc4",
      });
    };
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return tokens;
}

export function HeroScene() {
  const tokens = useSceneTokens();
  const tilt = useRef<Tilt>({ x: 0, y: 0, active: false });
  const groupRef = useRef<THREE.Group>(null);
  const pieceRefs = useRef<(THREE.Group | null)[]>([]);

  // Device-orientation parallax for mobile.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      tilt.current.x = MathUtils.clamp(e.gamma / TILT_DIVISOR, -1, 1);
      tilt.current.y = MathUtils.clamp((e.beta - 45) / TILT_DIVISOR, -1, 1);
      tilt.current.active = true;
    };
    window.addEventListener("deviceorientation", handler);
    return () => window.removeEventListener("deviceorientation", handler);
  }, []);

  // Camera looks straight forward (lookAt y-axis through origin). The
  // cluster sits to the right because PLINTH.x is positive — not because
  // the camera is panned to follow it. This is what keeps the left side
  // of the stage clear for the editorial overlay text.
  useFrame((state, dt) => {
    const t = tilt.current;
    const px = t.active ? t.x : state.pointer.x;
    const py = t.active ? t.y : state.pointer.y;
    state.camera.position.x = MathUtils.damp(state.camera.position.x, px * 0.4, 4, dt);
    state.camera.position.y = MathUtils.damp(state.camera.position.y, 1.7 + py * 0.25, 4, dt);
    state.camera.lookAt(0, 1.0, 0);
  });

  // Entrance — pieces drop onto the plinth, staggered.
  useGSAP(
    () => {
      const tl = gsap.timeline({ delay: 0.15 });
      pieceRefs.current.forEach((p, i) => {
        if (!p) return;
        const finalY = p.position.y;
        p.position.y = finalY + 4.0;
        p.scale.set(0.85, 0.85, 0.85);
        const finalRy = p.rotation.y;
        p.rotation.y = finalRy - 0.4;
        tl.to(p.position, { y: finalY, duration: 0.9, ease: "power3.out" }, 0.3 + i * 0.1);
        tl.to(p.scale, { x: 1, y: 1, z: 1, duration: 0.85, ease: "back.out(1.4)" }, 0.3 + i * 0.1);
        tl.to(p.rotation, { y: finalRy, duration: 1.0, ease: "power2.out" }, 0.3 + i * 0.1);
      });
    },
    { scope: groupRef },
  );

  return (
    <>
      <fog attach="fog" args={[tokens.fog, 9, 24]} />
      <hemisphereLight args={["#fbf3df", "#6a5a3a", 0.55]} />
      <directionalLight
        position={[5, 7, 4]}
        intensity={1.6}
        color="#ffe8c2"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={22}
        shadow-camera-left={-2}
        shadow-camera-right={9}
        shadow-camera-top={5}
        shadow-camera-bottom={-2}
        shadow-bias={-0.0008}
        shadow-radius={4}
      />
      <directionalLight position={[-4, 3, -3]} intensity={0.4} color="#c6d8e0" />

      {/* Floor — wide plane, receives plinth shadow */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 16]} />
        <meshStandardMaterial color={tokens.floor} roughness={0.95} transparent opacity={0.85} />
      </mesh>

      {/* Plinth — walnut block the cluster sits on */}
      <mesh
        position={[PLINTH.x, PLINTH.y, PLINTH.z]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[PLINTH.w, PLINTH.h, PLINTH.d]} />
        <meshPhysicalMaterial
          color={tokens.plinth}
          roughness={0.55}
          clearcoat={0.25}
          clearcoatRoughness={0.5}
        />
      </mesh>

      {/* Cluster — 5 pieces on plinth top */}
      <group ref={groupRef} position={[PLINTH.x, PLINTH_TOP, 0]}>
        {LAYOUT.map((p, i) => (
          <group
            key={`${p.kind}-${p.color}-${i}`}
            ref={(el) => {
              pieceRefs.current[i] = el;
            }}
            position={[p.x, 0, p.z]}
            rotation={[0, p.ry, 0]}
          >
            <HeroPiece kind={p.kind} color={p.color} />
          </group>
        ))}
      </group>
    </>
  );
}
