"use client";

import { useSyncExternalStore } from "react";
import { useOnyxStore } from "@/lib/store";
import type { ThemeMode } from "@/lib/themes";

const QUERY = "(prefers-color-scheme: light)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

const systemPrefersLight = () => window.matchMedia(QUERY).matches;

/** The theme actually in effect, resolving "follow system" against the OS. */
export function useEffectiveTheme(): ThemeMode {
  const theme = useOnyxStore((s) => s.theme);
  const follow = useOnyxStore((s) => s.settings.followSystemTheme);
  const light = useSyncExternalStore(subscribe, systemPrefersLight, () => false);
  return follow ? (light ? "light" : "dark") : theme;
}
