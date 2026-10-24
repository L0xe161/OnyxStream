"use client";

import { useEffect, useRef } from "react";
import { useOnyxStore } from "@/lib/store";
import { BROWSER_CHROME, getAccent, resolveAccent } from "@/lib/themes";
import { dirFor } from "@/lib/i18n";
import { useEffectiveTheme } from "./use-effective-theme";

const THEME_CLASSES = ["theme-dark", "theme-light", "theme-frosted"] as const;

/**
 * Mirrors the user's appearance choices onto <html>: language and direction,
 * theme class, accent variables (contrast-resolved per theme), and the
 * data-attributes the stylesheet keys off (corners, density, text size,
 * poster size, motion, font). Theme and language changes cross-fade.
 */
export function useThemeApplier() {
  const theme = useEffectiveTheme();
  const accent = useOnyxStore((s) => s.accent);
  const lang = useOnyxStore((s) => s.lang);
  const settings = useOnyxStore((s) => s.settings);
  const first = useRef(true);

  useEffect(() => {
    const root = document.documentElement;
    let fadeTimer: number | undefined;

    if (!first.current && settings.motion !== "off") {
      root.classList.add("theme-fade");
      fadeTimer = window.setTimeout(() => root.classList.remove("theme-fade"), 380);
    }
    first.current = false;

    root.lang = lang;
    root.dir = dirFor(lang);

    root.classList.remove(...THEME_CLASSES);
    root.classList.add(`theme-${theme}`);

    const resolved = resolveAccent(getAccent(accent).color, theme);
    root.style.setProperty("--primary", resolved.primary);
    root.style.setProperty("--primary-foreground", resolved.onPrimary);
    root.style.setProperty("--accent", resolved.hover);
    root.style.setProperty("--ring", resolved.primary);
    root.style.setProperty("--sidebar-primary", resolved.primary);
    root.style.setProperty("--sidebar-ring", resolved.primary);
    root.style.setProperty("--chart-1", resolved.primary);

    root.dataset.corners = settings.corners;
    root.dataset.density = settings.density;
    root.dataset.poster = settings.posterSize;
    root.dataset.motion = settings.motion;
    root.dataset.font = settings.fontStyle;
    root.style.setProperty("--text-scale", String(settings.textScale / 100));

    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", BROWSER_CHROME[theme]);

    return () => window.clearTimeout(fadeTimer);
  }, [theme, accent, lang, settings]);
}
