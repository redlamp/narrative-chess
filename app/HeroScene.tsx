"use client";

import { useFrame } from "@react-three/fiber";
import { Center, Text3D } from "@react-three/drei";
import { MathUtils } from "three";
import { HeroPiece } from "./HeroPiece";

const FONT_URL = "/fonts/helvetiker_bold.typeface.json";

export function HeroScene() {
  useFrame((state) => {
    const target = state.pointer;
    state.camera.position.x = MathUtils.damp(
      state.camera.position.x,
      target.x * 0.4,
      4,
      1 / 60,
    );
    state.camera.position.y = MathUtils.damp(
      state.camera.position.y,
      target.y * 0.25,
      4,
      1 / 60,
    );
    state.camera.lookAt(0, 0, 0);
  });

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 10, 5]} intensity={1.2} />

      {/* Title — two lines, white in both modes */}
      <Center disableY>
        <group>
          <Text3D font={FONT_URL} size={1} height={0.15} position={[0, 0.6, 0]}>
            Narrative
            <meshStandardMaterial color="white" roughness={0.4} metalness={0.1} />
          </Text3D>
          <Text3D font={FONT_URL} size={1} height={0.15} position={[0, -0.7, 0]}>
            Chess
            <meshStandardMaterial color="white" roughness={0.4} metalness={0.1} />
          </Text3D>
        </group>
      </Center>

      {/* Left: white pieces */}
      <HeroPiece kind="rook" color="white" position={[-3.2, 0.8, 0]} rotation={[0, 0.2, 0]} />
      <HeroPiece kind="bishop" color="white" position={[-3.4, -0.5, 0]} rotation={[0, -0.3, 0]} />
      <HeroPiece kind="pawn" color="white" position={[-3.0, -1.6, 0]} rotation={[0, 0.1, 0]} />

      {/* Right: black pieces */}
      <HeroPiece kind="king" color="black" position={[3.2, 0.4, 0]} rotation={[0, -0.2, 0]} />
      <HeroPiece kind="queen" color="black" position={[3.4, -1.0, 0]} rotation={[0, 0.3, 0]} />
    </>
  );
}
