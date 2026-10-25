import type { CategoryTab } from "./types";

export type CornerStyle = "sharp" | "soft" | "round";
export type Density = "compact" | "comfortable" | "spacious";
export type MotionPreference = "system" | "full" | "reduced" | "off";
export type PosterSize = "sm" | "md" | "lg";
export type SubtitleChoice = "off" | "ar" | "en" | "fr" | "es" | "de" | "tr";
export type FontStyle = "editorial" | "neutral";
export type ResumeBehavior = "ask" | "always" | "never";

/** Home rows the user can show, hide and reorder. */
export type HomeRowId =
  | "continue"
  | "trending"
  | "movies"
  | "tv"
  | "anime"
  | "cartoons"
  | "topMovies"
  | "topTV"
  | "upcoming"
  | "genres";

export interface HomeRowSetting {
  id: HomeRowId;
  visible: boolean;
}

export interface TabSetting {
  id: CategoryTab;
  visible: boolean;
}

export interface Settings {
  /** Kept for migration compatibility only; the System theme option has been removed from the UI, so this is always false. */
  followSystemTheme: boolean;
  corners: CornerStyle;
  density: Density;
  posterSize: PosterSize;
  fontStyle: FontStyle;
  browseLayout: "rows" | "grid";
  homeRows: HomeRowSetting[];
  tabs: TabSetting[];
  heroEnabled: boolean;
  motion: MotionPreference;
  heroAutoplay: boolean;
  heroIntervalMs: 6000 | 8000 | 12000;
  autoPlayNext: boolean;
  resume: ResumeBehavior;
  hideWatched: boolean;
  hideAdult: boolean;
  originalLanguages: string[];
  /** ISO-3166-1 codes; the first one is sent as `region` to TMDB discover. */
  preferredRegions: string[];
}

export const DEFAULT_HOME_ROWS: HomeRowSetting[] = (
  ["continue", "trending", "movies", "tv", "anime", "cartoons", "topMovies", "topTV", "upcoming", "genres"] as const
).map((id) => ({ id, visible: true }));

export const DEFAULT_TABS: TabSetting[] = (
  ["all", "movies", "tv", "anime", "cartoons", "catalog", "favorites"] as const
).map((id) => ({ id, visible: true }));

export const DEFAULT_SETTINGS: Settings = {
  followSystemTheme: false,
  corners: "soft",
  density: "comfortable",
  posterSize: "md",
  fontStyle: "editorial",
  browseLayout: "rows",
  homeRows: DEFAULT_HOME_ROWS,
  tabs: DEFAULT_TABS,
  heroEnabled: true,
  motion: "system",
  heroAutoplay: true,
  // Slider duration: 6 seconds per slide (per spec).
  heroIntervalMs: 6000,
  autoPlayNext: false,
  resume: "ask",
  // Force-enabled in the background: finished titles are always hidden.
  // The toggle was removed from the Settings UI; this value is also forced
  // back to true in `sanitizePersisted` so existing users are migrated.
  hideWatched: true,
  // Adult content is shown by default; the toggle stays in Settings.
  hideAdult: false,
  originalLanguages: [],
  preferredRegions: [],
};

/**
 * Reconciles a stored list with the canonical one: keeps the user's order and
 * visibility, drops ids that no longer exist and appends ids added later.
 */
export function reconcileList<T extends { id: string }>(stored: readonly T[] | undefined, canonical: readonly T[]): T[] {
  const known = new Set(canonical.map((c) => c.id));
  const kept = (stored ?? []).filter((s, i, all) => known.has(s.id) && all.findIndex((x) => x.id === s.id) === i);
  const seen = new Set(kept.map((k) => k.id));
  return [...kept, ...canonical.filter((c) => !seen.has(c.id))];
}
