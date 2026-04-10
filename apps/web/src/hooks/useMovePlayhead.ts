import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

type UseMovePlayheadOptions = {
  targetPly: number;
  totalPlies: number;
  resetKey?: number;
  baseDurationSeconds?: number;
  extraDurationPerPlySeconds?: number;
  maxDurationSeconds?: number;
};

export function useMovePlayhead({
  targetPly,
  totalPlies,
  resetKey = 0,
  baseDurationSeconds = 0.6,
  extraDurationPerPlySeconds = 0.12,
  maxDurationSeconds = 1.08
}: UseMovePlayheadOptions) {
  const initialTarget = clamp(targetPly, 0, totalPlies);
  const [playhead, setPlayhead] = useState(initialTarget);
  const playheadStateRef = useRef({ value: initialTarget });
  const tweenRef = useRef<gsap.core.Tween | null>(null);
  const pendingResetRef = useRef(false);

  useEffect(() => {
    return () => {
      tweenRef.current?.kill();
      tweenRef.current = null;
    };
  }, []);

  useEffect(() => {
    pendingResetRef.current = true;
  }, [resetKey]);

  useEffect(() => {
    const nextTarget = clamp(targetPly, 0, totalPlies);

    if (pendingResetRef.current) {
      tweenRef.current?.kill();
      tweenRef.current = null;
      playheadStateRef.current.value = nextTarget;
      pendingResetRef.current = false;
      setPlayhead(nextTarget);
      return;
    }

    const currentPlayhead = playheadStateRef.current.value;
    if (Math.abs(currentPlayhead - nextTarget) < 0.001) {
      playheadStateRef.current.value = nextTarget;
      setPlayhead(nextTarget);
      return;
    }

    tweenRef.current?.kill();
    tweenRef.current = null;

    const distance = Math.abs(nextTarget - currentPlayhead);
    const duration = gsap.utils.clamp(
      baseDurationSeconds,
      maxDurationSeconds,
      baseDurationSeconds + Math.max(0, distance - 1) * extraDurationPerPlySeconds
    );

    tweenRef.current = gsap.to(playheadStateRef.current, {
      value: nextTarget,
      duration,
      ease: "power2.out",
      overwrite: "auto",
      onUpdate: () => {
        setPlayhead(playheadStateRef.current.value);
      },
      onComplete: () => {
        playheadStateRef.current.value = nextTarget;
        setPlayhead(nextTarget);
        tweenRef.current = null;
      }
    });
  }, [baseDurationSeconds, extraDurationPerPlySeconds, maxDurationSeconds, targetPly, totalPlies]);

  return playhead;
}
