"use client";

import { useEffect, useState } from "react";
import { dominantColor, toHex } from "@/lib/color";
import { resolveAccent, type ThemeMode } from "@/lib/themes";
import { useEffectiveTheme } from "./use-effective-theme";

const SAMPLE = 32;
const cache = new Map<string, string | null>();

function sample(url: string): Promise<string | null> {
  const hit = cache.get(url);
  if (hit !== undefined) return Promise.resolve(hit);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = SAMPLE;
        canvas.height = SAMPLE;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx?.drawImage(img, 0, 0, SAMPLE, SAMPLE);
        const rgb = ctx ? dominantColor(ctx.getImageData(0, 0, SAMPLE, SAMPLE).data) : null;
        const hex = rgb ? toHex(rgb) : null;
        cache.set(url, hex);
        resolve(hex);
      } catch {
        cache.set(url, null);
        resolve(null);
      }
    };
    img.onerror = () => {
      cache.set(url, null);
      resolve(null);
    };
    img.src = url;
  });
}

export interface TitleAccent {
  /** CSS custom properties to spread onto a container's style. */
  style: Record<string, string>;
}

/**
 * A per-title accent derived from its artwork, adjusted so it always meets
 * contrast for the active theme. Falls back to the user's accent while loading
 * or when the image cannot be sampled.
 */
export function useArtworkAccent(path: string | null | undefined, theme?: ThemeMode): TitleAccent {
  const active = useEffectiveTheme();
  const [raw, setRaw] = useState<{ path: string; hex: string | null } | null>(null);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    void sample(`https://image.tmdb.org/t/p/w185${path}`).then((hex) => {
      if (!cancelled) setRaw({ path, hex });
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  const hex = raw && raw.path === path ? raw.hex : null;
  if (!hex) return { style: {} };
  const resolved = resolveAccent(hex, theme ?? active);
  return {
    style: {
      "--title-accent": resolved.primary,
      "--title-accent-ink": resolved.onPrimary,
    },
  };
}
