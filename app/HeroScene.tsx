"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Center, Text3D } from "@react-three/drei";
import { MathUtils } from "three";
import { HeroPiece } from "./HeroPiece";

const FONT_URL = "/fonts/helvetiker_bold.typeface.json";

// Reference scene width in world units. Below this, the whole hero scales
// down so the title + pieces stay inside the visible viewport on narrow
// windows.
const REFERENCE_WIDTH = 9.5;

// Common ground baseline Y for all pieces. Bases sit at Y=0; this offset
// shifts the whole arc below the title.
const PIECE_Y = -1.7;

// Vertical offset for the entire hero group. Shifts the composition above
// mid-screen — the camera looks at world origin, so pushing the scene up
// in Y moves it toward the top of the viewport.
const SCENE_Y = 1.0;

// How aggressively device tilt drives the parallax. gamma (left-right) and
// beta (front-back) are in degrees; dividing by 25 gives ~1.0 at 25° tilt
// which is comfortable thumb travel on a phone in portrait.
const TILT_DIVISOR = 25;

type Tilt = { x: number; y: number; active: boolean };

export function HeroScene() {
  const { viewport } = useThree();
  const scale = Math.min(1, viewport.width / REFERENCE_WIDTH);

  // Device-orientation parallax for mobile. Falls back to mouse pointer on
  // desktops + iOS-without-permission. We don't prompt for permission; iOS
  // users who want tilt will get a static hero, which is fine.
  const tilt = useRef<Tilt>({ x: 0, y: 0, active: false });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      // Beta has a 45°-ish neutral when phone is held upright; subtract that
      // so a "looking at it normally" pose maps to ~0.
      const x = MathUtils.clamp(e.gamma / TILT_DIVISOR, -1, 1);
      const y = MathUtils.clamp((e.beta - 45) / TILT_DIVISOR, -1, 1);
      tilt.current.x = x;
      tilt.current.y = y;
      tilt.current.active = true;
    };
    window.addEventListener("deviceorientation", handler);
    return () => window.removeEventListener("deviceorientation", handler);
  }, []);

  useFrame((state) => {
    const t = tilt.current;
    const targetX = t.active ? t.x : state.pointer.x;
    const targetY = t.active ? t.y : state.pointer.y;
    state.camera.position.x = MathUtils.damp(
      state.camera.position.x,
      targetX * 0.4,
      4,
      1 / 60,
    );
    state.camera.position.y = MathUtils.damp(
      state.camera.position.y,
      targetY * 0.25,
      4,
      1 / 60,
    );
    state.camera.lookAt(0, 0, 0);
  });

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 10, 5]} intensity={1.2} />

      <group scale={[scale, scale, scale]} position={[0, SCENE_Y, 0]}>
        {/* Title — two lines, each centered horizontally on its own. Wrapping
            each <Text3D> in its own <Center> avoids the "shorter line aligns
            left of longer line" effect of a single shared <Center>. */}
        {/* "Chess" baseline sits on PIECE_Y so the text rests on the same
            ground as the pieces. "Narrative" stacks 1.2 units above (line
            spacing) so the two-line title reads as one block above ground. */}
        <Center disableY position={[0, PIECE_Y + 1.2, 0]}>
          <Text3D
            font={FONT_URL}
            size={1}
            height={0.18}
            bevelEnabled
            bevelSize={0.025}
            bevelThickness={0.04}
            bevelSegments={4}
          >
            Narrative
            <meshStandardMaterial color="white" roughness={0.4} metalness={0.1} />
          </Text3D>
        </Center>
        <Center disableY position={[0, PIECE_Y, 0]}>
          <Text3D
            font={FONT_URL}
            size={1}
            height={0.18}
            bevelEnabled
            bevelSize={0.025}
            bevelThickness={0.04}
            bevelSegments={4}
          >
            Chess
            <meshStandardMaterial color="white" roughness={0.4} metalness={0.1} />
          </Text3D>
        </Center>

        {/* Left: white pieces — arc around the left edge of the title.
            All pieces share PIECE_Y (resting on the same ground); the X-Z
            offsets create the arc curving outward and slightly forward of
            the text plane. */}
        <HeroPiece
          kind="pawn"
          color="white"
          position={[-2.4, PIECE_Y, 0.5]}
          rotation={[0, 0.25, 0]}
        />
        <HeroPiece
          kind="bishop"
          color="white"
          position={[-3.4, PIECE_Y, 0.0]}
          rotation={[0, -0.15, 0]}
        />
        <HeroPiece
          kind="rook"
          color="white"
          position={[-4.2, PIECE_Y, -0.5]}
          rotation={[0, 0.4, 0]}
        />

        {/* Right: black pieces — arc around the right edge of the title. */}
        <HeroPiece
          kind="king"
          color="black"
          position={[2.4, PIECE_Y, 0.5]}
          rotation={[0, -0.25, 0]}
        />
        <HeroPiece
          kind="queen"
          color="black"
          position={[3.7, PIECE_Y, -0.2]}
          rotation={[0, 0.2, 0]}
        />
      </group>
    </>
  );
}
