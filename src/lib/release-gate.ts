import type { TMDBMediaItem } from "./types";

/**
 * Movies are gated behind a "coming soon" notice for this many days after
 * their release date (and until release day for future-dated titles).
 * TV series are never gated.
 */
export const MOVIE_AVAILABILITY_DELAY_DAYS = 30;

const DAY_MS = 86_400_000;

/** True when the item is a movie (TV series are never subject to the gate). */
export function isMovieItem(media: TMDBMediaItem): boolean {
  return media.media_type !== "tv" && !media.first_air_date && !media.number_of_seasons;
}

/**
 * Whole days between the movie's TMDB `release_date` and `now`, counted in
 * UTC so the result is stable regardless of the viewer's timezone. Negative
 * values mean the movie has not been released yet. Returns `null` when the
 * item is not a movie or has no usable release date (nothing to gate on).
 */
export function daysSinceMovieRelease(media: TMDBMediaItem, now: Date = new Date()): number | null {
  if (!isMovieItem(media)) return null;
  const raw = media.release_date;
  if (!raw) return null;
  const release = Date.parse(`${raw.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(release)) return null;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((today - release) / DAY_MS);
}

/**
 * A movie counts as "coming soon" until `MOVIE_AVAILABILITY_DELAY_DAYS` days
 * have passed since its `release_date`; movies dated in the future (not yet
 * released) are always coming soon. TV series and movies without a usable
 * release date are never gated.
 *
 * The verdict is derived from the clock on every call — nothing is cached or
 * persisted — so it updates automatically as time passes, with no manual
 * intervention: a movie that crosses the 30-day line simply starts playing
 * the next time it is opened.
 */
export function isComingSoonMovie(media: TMDBMediaItem, now: Date = new Date()): boolean {
  const days = daysSinceMovieRelease(media, now);
  if (days === null) return false;
  return days < MOVIE_AVAILABILITY_DELAY_DAYS;
}
