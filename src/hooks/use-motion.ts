"use client";

import { useReducedMotion } from "framer-motion";
import { useOnyxStore } from "@/lib/store";

export type MotionLevel = "full" | "reduced" | "off";

/**
 * Resolves the user's motion preference. "system" follows the OS
 * `prefers-reduced-motion` setting; "reduced" swaps movement for fades;
 * "off" removes animation entirely.
 */
export function useMotion(): { level: MotionLevel; reduced: boolean; off: boolean } {
  const preference = useOnyxStore((s) => s.settings.motion);
  const osReduced = useReducedMotion();
  const level: MotionLevel = preference === "system" ? (osReduced ? "reduced" : "full") : preference;
  return { level, reduced: level !== "full", off: level === "off" };
}
