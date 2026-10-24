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
  followSystemTheme: boolean;
  corners: CornerStyle;
  density: Density;
  /** Root font scale in percent. */
  textScale: 90 | 100 | 112 | 125;
  posterSize: PosterSize;
  fontStyle: FontStyle;
  browseLayout: "rows" | "grid";
  homeRows: HomeRowSetting[];
  tabs: TabSetting[];
  heroEnabled: boolean;
  motion: MotionPreference;
  heroAutoplay: boolean;
  heroIntervalMs: 6000 | 8000 | 12000;
  subtitleLang: SubtitleChoice;
  rememberSubtitle: boolean;
  autoFallback: boolean;
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
  ["all", "movies", "tv", "anime", "cartoons", "catalog", "favorites", "watchlist"] as const
).map((id) => ({ id, visible: true }));

export const DEFAULT_SETTINGS: Settings = {
  followSystemTheme: false,
  corners: "soft",
  density: "comfortable",
  textScale: 100,
  posterSize: "md",
  fontStyle: "editorial",
  browseLayout: "rows",
  homeRows: DEFAULT_HOME_ROWS,
  tabs: DEFAULT_TABS,
  heroEnabled: true,
  motion: "system",
  heroAutoplay: true,
  heroIntervalMs: 8000,
  subtitleLang: "ar",
  rememberSubtitle: true,
  autoFallback: true,
  autoPlayNext: false,
  resume: "ask",
  hideWatched: false,
  hideAdult: true,
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
