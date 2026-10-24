"use client";

import { useThemeApplier } from "@/hooks/use-theme-applier";

/** Mount-only component that runs the theme application effect. */
export function ThemeApplier() {
  useThemeApplier();
  return null;
}
