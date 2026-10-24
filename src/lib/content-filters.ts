import type { Settings } from "./settings";
import type { ContinueWatchingItem, TMDBMediaItem } from "./types";

/** A title counts as finished once its tracked progress passes this point. */
export const WATCHED_THRESHOLD = 0.9;

export function watchedIds(history: readonly ContinueWatchingItem[]): Set<number> {
  return new Set(history.filter((h) => h.progress >= WATCHED_THRESHOLD).map((h) => h.media.id));
}

/**
 * Applies the user's content preferences to a browse list. Personal lists
 * (favourites, watchlist) are never filtered: those are the user's own picks.
 */
export function applyContentFilters(
  items: readonly TMDBMediaItem[],
  settings: Pick<Settings, "hideAdult" | "hideWatched" | "originalLanguages">,
  watched: ReadonlySet<number>
): TMDBMediaItem[] {
  const languages = new Set(settings.originalLanguages);
  return items.filter((item) => {
    if (settings.hideAdult && item.adult) return false;
    if (settings.hideWatched && watched.has(item.id)) return false;
    if (languages.size > 0 && item.original_language && !languages.has(item.original_language)) return false;
    return true;
  });
}
