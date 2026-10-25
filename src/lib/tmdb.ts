import type {
  TMDBMediaItem,
  TMDBSeasonDetails,
  TMDBSeasonSummary,
  TMDBImagesResponse,
  MediaType,
  Language,
  ArtworkLanguage,
  TMDBGenre,
  TMDBPerson,
  TMDBPersonCredits,
  TMDBSearchPersonResult,
  TMDBTranslation,
  CatalogFilters,
  SortOption,
} from "./types";
import { isComingSoonMovie, MOVIE_AVAILABILITY_DELAY_DAYS } from "./release-gate";

const TMDB_BASE_URL = "/api/tmdb";

export type ImageSize = "w92" | "w154" | "w185" | "w342" | "w500" | "w780" | "w1280" | "original";

export function getTMDBImageUrl(
  path: string | null | undefined,
  size: ImageSize = "w500"
): string {
  if (!path) {
    // Neutral placeholder that fits the dark cinema theme.
    return "data:image/svg+xml;utf8," + encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='500' height='750' viewBox='0 0 500 750'><rect width='500' height='750' fill='#12141a'/><text x='250' y='375' font-family='monospace' font-size='28' fill='#1f2833' text-anchor='middle'>ONYX</text></svg>`
    );
  }
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export interface TMDBRequestOptions {
  artworkLang?: ArtworkLanguage;
  uiLang?: Language;
  page?: number;
}

/** Build TMDB query params honoring dual artwork / UI language. */
function buildParams(options: TMDBRequestOptions = {}): URLSearchParams {
  const params = new URLSearchParams();
  const artworkLang = options.artworkLang ?? "en";
  const uiLang = options.uiLang ?? "en";

  if (artworkLang === "ar" || uiLang === "ar") {
    // Arabic-localized metadata + Arabic-included artwork per spec.
    params.set("language", "ar-SA");
    params.set("include_image_language", "ar,en,null");
  } else {
    params.set("language", "en-US");
    params.set("include_image_language", "en,null");
  }

  if (options.page) {
    params.set("page", String(options.page));
  }

  return params;
}

async function tmdbFetch<T>(endpoint: string, params: URLSearchParams): Promise<T | null> {
  try {
    const res = await fetch(`${TMDB_BASE_URL}/${endpoint}?${params.toString()}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

interface TMDBListResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

function withMediaType(items: TMDBMediaItem[], type: MediaType): TMDBMediaItem[] {
  return items.map((item) => ({ ...item, media_type: item.media_type ?? type }));
}

export async function fetchTrending(options: TMDBRequestOptions = {}): Promise<TMDBMediaItem[]> {
  const params = buildParams(options);
  const data = await tmdbFetch<TMDBListResponse<TMDBMediaItem>>("trending/all/day", params);
  if (!data) return [];
  return (data.results || []).filter((i) => i.poster_path || i.backdrop_path);
}

export async function fetchPopularMovies(options: TMDBRequestOptions = {}): Promise<TMDBMediaItem[]> {
  const params = buildParams(options);
  const data = await tmdbFetch<TMDBListResponse<TMDBMediaItem>>("movie/popular", params);
  if (!data) return [];
  return withMediaType(data.results || [], "movie");
}

export async function fetchPopularTV(options: TMDBRequestOptions = {}): Promise<TMDBMediaItem[]> {
  const params = buildParams(options);
  const data = await tmdbFetch<TMDBListResponse<TMDBMediaItem>>("tv/popular", params);
  if (!data) return [];
  return withMediaType(data.results || [], "tv");
}

export async function fetchAnime(options: TMDBRequestOptions = {}): Promise<TMDBMediaItem[]> {
  const params = buildParams(options);
  params.set("with_genres", "16");
  params.set("with_original_language", "ja");
  params.set("sort_by", "popularity.desc");
  const data = await tmdbFetch<TMDBListResponse<TMDBMediaItem>>("discover/tv", params);
  if (!data) return [];
  return withMediaType(data.results || [], "tv");
}

export async function fetchCartoons(options: TMDBRequestOptions = {}): Promise<TMDBMediaItem[]> {
  const params = buildParams(options);
  params.set("with_genres", "16");
  params.set("without_original_language", "ja");
  params.set("sort_by", "popularity.desc");
  const data = await tmdbFetch<TMDBListResponse<TMDBMediaItem>>("discover/tv", params);
  if (!data) return [];
  return withMediaType(data.results || [], "tv");
}

export async function fetchTopRated(
  type: MediaType = "movie",
  options: TMDBRequestOptions = {}
): Promise<TMDBMediaItem[]> {
  // Full pagination: TMDB's top_rated returns one page (20 items) per request.
  // We fetch the first several pages in parallel and concatenate so the row is
  // not truncated at 20 — the spec asks for the full list, continuous listing.
  const PAGES = 5;
  const pageParams = Array.from({ length: PAGES }, (_, i) => {
    const params = buildParams(options);
    params.set("page", String(i + 1));
    return params;
  });
  const responses = await Promise.all(
    pageParams.map((params) => tmdbFetch<TMDBListResponse<TMDBMediaItem>>(`${type}/top_rated`, params))
  );
  const items: TMDBMediaItem[] = [];
  for (const data of responses) {
    if (!data) continue;
    items.push(...withMediaType(data.results || [], type));
  }
  // De-duplicate by id (TMDB can overlap across pages in rare cases).
  const seen = new Set<number>();
  return items.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
}

/**
 * "Coming Soon" row: movies where fewer than `MOVIE_AVAILABILITY_DELAY_DAYS`
 * full days have passed since their `release_date` — i.e. recently-released
 * titles still inside their release gate PLUS genuinely upcoming (future-
 * dated) titles. Implemented via `discover/movie` with a release-date window
 * (the `/movie/upcoming` endpoint only returns future-dated titles, so it
 * would miss everything released in the last 29 days).
 *
 * The window is computed in UTC so the result matches the verdict of
 * `isComingSoonMovie()` (which also counts whole UTC days). A final safety
 * filter through `isComingSoonMovie` guards against any timezone drift.
 */
export async function fetchUpcoming(options: TMDBRequestOptions = {}): Promise<TMDBMediaItem[]> {
  const params = buildParams(options);
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const DAY = 86_400_000;
  // gte = today - (DELAY - 1) days: a movie released exactly this many days
  // ago is on day (DELAY - 1), which is still < DELAY → gated / coming soon.
  const since = new Date(todayUtc - (MOVIE_AVAILABILITY_DELAY_DAYS - 1) * DAY);
  // lte = today + 1 year: include not-yet-released titles up to a year out.
  const until = new Date(todayUtc + 365 * DAY);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  params.set("primary_release_date.gte", fmt(since));
  params.set("primary_release_date.lte", fmt(until));
  params.set("sort_by", "primary_release_date.desc");
  params.set("include_adult", "false");
  const data = await tmdbFetch<TMDBListResponse<TMDBMediaItem>>("discover/movie", params);
  if (!data) return [];
  const items = withMediaType(data.results || [], "movie").filter((m) => m.poster_path || m.backdrop_path);
  // Safety net: drop anything that does not actually pass the 30-day gate.
  return items.filter((m) => isComingSoonMovie(m));
}

export async function searchMulti(query: string, options: TMDBRequestOptions = {}): Promise<TMDBMediaItem[]> {
  if (!query.trim()) return [];
  const params = buildParams(options);
  params.set("query", query.trim());
  const data = await tmdbFetch<TMDBListResponse<TMDBMediaItem>>("search/multi", params);
  if (!data) return [];
  return (data.results || []).filter(
    (i) => (i.media_type === "movie" || i.media_type === "tv") && (i.poster_path || i.backdrop_path)
  );
}

export async function fetchDetails(
  id: number,
  type: MediaType,
  options: TMDBRequestOptions = {}
): Promise<TMDBMediaItem | null> {
  const params = buildParams(options);
  // `translations` lets us fall back to the English title/overview/tagline
  // when the requested language has no translation for a title, without a
  // second API round-trip.
  params.set("append_to_response", "credits,images,recommendations,similar,videos,translations");
  const data = await tmdbFetch<TMDBMediaItem>(`${type}/${id}`, params);
  if (!data) return null;
  const item = { ...data, media_type: type };
  applyTranslationFallback(item);
  return item;
}

/**
 * True when a string is missing or only whitespace — TMDB returns "" for a
 * field that has no translation in the requested language.
 */
const isEmpty = (s: string | undefined | null): s is "" =>
  !s || !s.trim();

/**
 * Fills in missing localized fields from the English translation bundled in
 * `append_to_response=translations`. TMDB returns the original-language title
 * (and an empty overview) when the requested language has no translation, so:
 *
 *  - overview: if the localized overview is empty, use the English one.
 *  - title/name: if the localized title equals the original (i.e. no
 *    translation exists) and the English title is a real translation
 *    (differs from the original), use the English title.
 *  - tagline: if empty, use the English tagline.
 *
 * No-ops when there is no `translations` table (older responses) or no English
 * entry; in those cases the original fields are left untouched.
 */
function applyTranslationFallback(item: TMDBMediaItem): void {
  const list = item.translations?.translations;
  if (!list || list.length === 0) return;
  const en = findTranslation(list, "en");
  if (!en) return;

  if (isEmpty(item.overview)) {
    const enOverview = en.data.overview;
    if (enOverview && enOverview.trim()) item.overview = enOverview;
  }
  if (isEmpty(item.tagline)) {
    const enTagline = en.data.tagline;
    if (enTagline && enTagline.trim()) item.tagline = enTagline;
  }
  // Movie title: fall back to English when the localized title is missing or
  // identical to the original (TMDB returns the original when no localized
  // title exists).
  if (isEmpty(item.title) || item.title === item.original_title) {
    const enTitle = en.data.title;
    if (enTitle && enTitle.trim() && enTitle !== item.original_title) {
      item.title = enTitle;
    }
  }
  // TV name: same logic.
  if (isEmpty(item.name) || item.name === item.original_name) {
    const enName = en.data.name;
    if (enName && enName.trim() && enName !== item.original_name) {
      item.name = enName;
    }
  }
}

/** Finds the first translation whose iso_639_1 matches the given language code. */
function findTranslation(list: TMDBTranslation[], lang: string): TMDBTranslation | undefined {
  return list.find((t) => t.iso_639_1 === lang);
}

/**
 * Lightweight localized fetch for a single movie or TV item — just the
 * title/overview/poster/backdrop in the requested language, with no
 * `append_to_response` (no credits / images / recommendations / videos /
 * translations). Used to refresh stored list snapshots (favorites,
 * continue-watching) when the interface language changes, so their titles
 * and artwork switch language without re-fetching the heavy details payload.
 * Returns null on failure so callers can keep the previously-stored item.
 */
export async function fetchItem(
  id: number,
  type: MediaType,
  options: TMDBRequestOptions = {}
): Promise<TMDBMediaItem | null> {
  const params = buildParams(options);
  const data = await tmdbFetch<TMDBMediaItem>(`${type}/${id}`, params);
  if (!data) return null;
  return { ...data, media_type: type };
}

/** Real season/episode counts for a series (specials, season 0, are excluded). */
export async function fetchShowStructure(
  tvId: number,
  options: TMDBRequestOptions = {}
): Promise<TMDBSeasonSummary[]> {
  const data = await tmdbFetch<TMDBMediaItem>(`tv/${tvId}`, buildParams(options));
  return (data?.seasons ?? [])
    .filter((s) => s.season_number > 0 && s.episode_count > 0)
    .sort((a, b) => a.season_number - b.season_number);
}

export async function fetchSeasonDetails(
  tvId: number,
  seasonNumber: number,
  options: TMDBRequestOptions = {}
): Promise<TMDBSeasonDetails | null> {
  const params = buildParams(options);
  return await tmdbFetch<TMDBSeasonDetails>(`tv/${tvId}/season/${seasonNumber}`, params);
}

export async function fetchMediaImages(
  id: number,
  type: MediaType
): Promise<TMDBImagesResponse | null> {
  const params = new URLSearchParams({ include_image_language: "ar,en,null" });
  return await tmdbFetch<TMDBImagesResponse>(`${type}/${id}/images`, params);
}

export async function fetchGenres(options: TMDBRequestOptions = {}): Promise<{ movie: TMDBGenre[]; tv: TMDBGenre[] }> {
  const params = buildParams(options);
  const [movieRes, tvRes] = await Promise.all([
    tmdbFetch<{ genres: TMDBGenre[] }>("genre/movie/list", params),
    tmdbFetch<{ genres: TMDBGenre[] }>("genre/tv/list", params),
  ]);
  return {
    movie: movieRes?.genres ?? [],
    tv: tvRes?.genres ?? [],
  };
}

export async function fetchByGenre(
  type: MediaType,
  genreId: number,
  options: TMDBRequestOptions = {}
): Promise<TMDBMediaItem[]> {
  const params = buildParams(options);
  params.set("with_genres", String(genreId));
  params.set("sort_by", "popularity.desc");
  const data = await tmdbFetch<TMDBListResponse<TMDBMediaItem>>(`discover/${type}`, params);
  if (!data) return [];
  return withMediaType(data.results || [], type);
}

/**
 * Full discover with rich filtering for the Catalog browser.
 * Returns the raw list response (so callers can read page / total_pages).
 */
export async function discoverMedia(
  filters: CatalogFilters,
  options: TMDBRequestOptions = {}
): Promise<TMDBListResponse<TMDBMediaItem>> {
  const params = buildParams(options);
  const { type, genreIds, yearFrom, yearTo, minRating, originalLanguage, region, sortBy, page } = filters;

  if (genreIds.length > 0) {
    // "," = AND, "|" = OR. Use AND when one genre, OR when multiple.
    params.set("with_genres", genreIds.join(","));
  }
  if (yearFrom || yearTo) {
    const dateKey = type === "movie" ? "primary_release_date" : "first_air_date";
    const from = `${yearFrom ?? 1900}-01-01`;
    const to = `${yearTo ?? new Date().getFullYear() + 1}-12-31`;
    params.set(`${dateKey}.gte`, from);
    params.set(`${dateKey}.lte`, to);
  }
  if (minRating) {
    params.set("vote_average.gte", String(minRating));
    params.set("vote_count.gte", "50");
  }
  if (originalLanguage) {
    params.set("with_original_language", originalLanguage);
  }
  if (filters.region) {
    params.set("region", filters.region);
  }
  params.set("sort_by", sortBy);
  params.set("page", String(page || 1));
  params.set("include_adult", "false");

  const data = await tmdbFetch<TMDBListResponse<TMDBMediaItem>>(`discover/${type}`, params);
  return data ?? { page: 1, results: [], total_pages: 0, total_results: 0 };
}

/**
 * Search people (directors / actors / crew). Returns person results with
 * `known_for` sample titles.
 */
export async function searchPerson(
  query: string,
  options: TMDBRequestOptions = {}
): Promise<TMDBSearchPersonResult[]> {
  if (!query.trim()) return [];
  const params = buildParams(options);
  params.set("query", query.trim());
  const data = await tmdbFetch<TMDBListResponse<TMDBSearchPersonResult>>("search/person", params);
  if (!data) return [];
  return (data.results || []).filter((p) => p.profile_path || (p.known_for && p.known_for.length));
}

/**
 * Loose-search normalization: lowercase, strips Arabic diacritics/tatweel,
 * unifies alef & yaa variants, and removes the punctuation (commas, colons,
 * dashes…) that often separates words in titles, so a query typed without
 * the comma still matches a title that contains one.
 */
export function normalizeForSearch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
    .replace(/[\u0623\u0625\u0622\u0671]/g, "\u0627")
    .replace(/\u0649/g, "\u064A")
    .replace(/\u0629/g, "\u0647")
    .replace(/[.,:;\u060C\u061B!?\u061F'\u2019\u201C\u201D"\u002D\u2013\u2014_()[\]{}<>«»/\\|*&^%$#@~`+=]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface MultiSearchBucket {
  media: TMDBMediaItem[];
  people: TMDBSearchPersonResult[];
}

/** Raw multi search in one specific TMDB language (no artwork mixing). */
async function searchMultiInLang(query: string, language: "en-US" | "ar-SA"): Promise<MultiSearchBucket> {
  const params = new URLSearchParams({ language, query });
  const data = await tmdbFetch<TMDBListResponse<TMDBMediaItem | TMDBSearchPersonResult>>(
    "search/multi",
    params
  );
  const media: TMDBMediaItem[] = [];
  const people: TMDBSearchPersonResult[] = [];
  if (!data) return { media, people };
  for (const r of data.results || []) {
    // search/multi mixes three shapes; `media_type` is the discriminator.
    const kind = (r as { media_type?: string }).media_type;
    if (kind === "person") {
      const p = r as TMDBSearchPersonResult;
      if (p.profile_path || (p.known_for && p.known_for.length)) people.push(p);
    } else if (kind === "movie" || kind === "tv") {
      const m = r as TMDBMediaItem;
      if (m.poster_path || m.backdrop_path) media.push(m);
    }
  }
  return { media, people };
}

/** Combined multi-search that returns both media and person results. */
export async function searchMultiWithPeople(
  query: string,
  options: TMDBRequestOptions = {}
): Promise<{ media: TMDBMediaItem[]; people: TMDBSearchPersonResult[] }> {
  const q = query.trim();
  if (!q) return { media: [], people: [] };

  // Search BOTH languages so an Arabic name finds an English-listed title and
  // vice versa, then merge the two result sets (primary language first).
  const primary: "en-US" | "ar-SA" =
    options.uiLang === "ar" || options.artworkLang === "ar" ? "ar-SA" : "en-US";
  const secondary: "en-US" | "ar-SA" = primary === "ar-SA" ? "en-US" : "ar-SA";

  // Space-insensitive: "black list" should match "The Blacklist". We also fire
  // the query with all spaces removed, so titles the provider stored as one
  // word still surface when the user types two.
  const spaceless = q.replace(/\s+/g, "");
  const queries = spaceless && spaceless !== q ? [q, spaceless] : [q];

  // Run every (query × language) combination in parallel, then fold them.
  const buckets = await Promise.all(
    queries.flatMap((term) => [searchMultiInLang(term, primary), searchMultiInLang(term, secondary)])
  );
  let main = buckets[0];
  let other = buckets[1];
  // If a spaceless variant returned extra results, fold them in too.
  if (queries.length > 1) {
    main = mergeBuckets(main, buckets[2]);
    other = mergeBuckets(other, buckets[3]);
  }

  // Punctuation-insensitive fallback: if nothing came back, retry with the
  // punctuation stripped (covers "The Good, the Bad and the Ugly").
  const loose = normalizeForSearch(q);
  if (loose && loose !== q.toLowerCase() && main.media.length + main.people.length + other.media.length + other.people.length === 0) {
    const [mainLoose, otherLoose] = await Promise.all([
      searchMultiInLang(loose, primary),
      searchMultiInLang(loose, secondary),
    ]);
    main = mainLoose;
    other = otherLoose;
  }

  // Merge: primary-language results keep their order and localized titles;
  // the other language fills in the bilingual title fields and adds anything
  // the primary search missed.
  const otherLang: "en" | "ar" = secondary === "ar-SA" ? "ar" : "en";
  const titleKey = `title_${otherLang}` as const;
  const nameKey = `name_${otherLang}` as const;
  const overviewKey = `overview_${otherLang}` as const;

  const mediaById = new Map<string, TMDBMediaItem>();
  for (const m of main.media) mediaById.set(`${m.media_type}-${m.id}`, m);

  const media: TMDBMediaItem[] = main.media.map((m) => {
    const o = other.media.find((x) => x.id === m.id && x.media_type === m.media_type);
    if (!o) return m;
    return {
      ...m,
      [titleKey]: o.title ?? o.original_title,
      [nameKey]: o.name ?? o.original_name,
      [overviewKey]: o.overview,
    } as TMDBMediaItem;
  });
  for (const o of other.media) {
    const key = `${o.media_type}-${o.id}`;
    if (mediaById.has(key)) continue;
    mediaById.set(key, o);
    media.push(o);
  }

  // Partial / substring ranking: prioritise results whose normalized title
  // contains the normalized query (so "black" floats The Blacklist, Black
  // Mirror… above incidental matches). Stable sort keeps TMDB's relevance
  // order inside each bucket.
  const needle = normalizeForSearch(q);
  if (needle) {
    const score = (m: TMDBMediaItem): number => {
      const title = normalizeForSearch(m.title || m.name || m.original_title || m.original_name || "");
      const orig = normalizeForSearch(m.original_title || m.original_name || "");
      if (title === needle || orig === needle) return 3;
      if (title.startsWith(needle) || orig.startsWith(needle)) return 2;
      if (title.includes(needle) || orig.includes(needle)) return 1;
      return 0;
    };
    media.sort((a, b) => score(b) - score(a));
  }

  const peopleById = new Set<number>();
  const people: TMDBSearchPersonResult[] = [];
  for (const p of [...main.people, ...other.people]) {
    if (peopleById.has(p.id)) continue;
    peopleById.add(p.id);
    people.push(p);
  }

  return { media, people };
}

/** Merges two single-language buckets, de-duplicating by media id + person id. */
function mergeBuckets(a: MultiSearchBucket, b: MultiSearchBucket): MultiSearchBucket {
  const mediaIds = new Set<string>();
  const media = [...a.media];
  for (const m of a.media) mediaIds.add(`${m.media_type}-${m.id}`);
  for (const m of b.media) {
    const key = `${m.media_type}-${m.id}`;
    if (!mediaIds.has(key)) {
      mediaIds.add(key);
      media.push(m);
    }
  }
  const peopleIds = new Set<number>();
  const people: TMDBSearchPersonResult[] = [];
  for (const p of [...a.people, ...b.people]) {
    if (peopleIds.has(p.id)) continue;
    peopleIds.add(p.id);
    people.push(p);
  }
  return { media, people };
}

export async function fetchPerson(
  id: number,
  options: TMDBRequestOptions = {}
): Promise<TMDBPerson | null> {
  const params = buildParams(options);
  params.set("append_to_response", "movie_credits,tv_credits,combined_credits,images,external_ids");
  const data = await tmdbFetch<TMDBPerson>(`person/${id}`, params);
  if (!data) return null;
  return { ...data, media_type: "person" };
}

export async function fetchPersonCredits(
  id: number,
  options: TMDBRequestOptions = {}
): Promise<TMDBPersonCredits | null> {
  const params = buildParams(options);
  // combined_credits gives both movie & tv cast/crew in one call.
  const data = await tmdbFetch<{ id: number; cast: TMDBPersonCredits["cast"]; crew: TMDBPersonCredits["crew"] }>(
    `person/${id}/combined_credits`,
    params
  );
  if (!data) return null;
  return { id: data.id, cast: data.cast ?? [], crew: data.crew ?? [] };
}

/** Languages offered in the catalog filter, with localized labels. */
export const ORIGINAL_LANGUAGES: { code: string; label: string; labelAr: string }[] = [
  { code: "en", label: "English", labelAr: "الإنجليزية" },
  { code: "ar", label: "Arabic", labelAr: "العربية" },
  { code: "ja", label: "Japanese", labelAr: "اليابانية" },
  { code: "ko", label: "Korean", labelAr: "الكورية" },
  { code: "fr", label: "French", labelAr: "الفرنسية" },
  { code: "es", label: "Spanish", labelAr: "الإسبانية" },
  { code: "de", label: "German", labelAr: "الألمانية" },
  { code: "tr", label: "Turkish", labelAr: "التركية" },
  { code: "hi", label: "Hindi", labelAr: "الهندية" },
  { code: "zh", label: "Chinese", labelAr: "الصينية" },
  { code: "it", label: "Italian", labelAr: "الإيطالية" },
  { code: "ru", label: "Russian", labelAr: "الروسية" },
];

export const SORT_OPTIONS: { value: SortOption; label: string; labelAr: string }[] = [
  { value: "popularity.desc", label: "Popularity ↓", labelAr: "الأكثر رواجاً" },
  { value: "popularity.asc", label: "Popularity ↑", labelAr: "الأقل رواجاً" },
  { value: "vote_average.desc", label: "Rating ↓", labelAr: "الأعلى تقييماً" },
  { value: "vote_average.asc", label: "Rating ↑", labelAr: "الأقل تقييماً" },
  { value: "primary_release_date.desc", label: "Newest", labelAr: "الأحدث" },
  { value: "primary_release_date.asc", label: "Oldest", labelAr: "الأقدم" },
  { value: "title.asc", label: "Title A–Z", labelAr: "الاسم أ–ي" },
  { value: "title.desc", label: "Title Z–A", labelAr: "الاسم ي–أ" },
];

/** Get a localized runtime string. */
export function formatRuntime(minutes?: number): string | null {
  if (!minutes || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Returns the "other language" title for a media item, given its primary title.
 * Used by bilingual card display — picks whichever of title_en/title_ar differs
 * from the primary, falling back to the original-language title.
 */
export function getBilingualOtherTitle(media: TMDBMediaItem, primaryTitle: string): string | undefined {
  if (media.title_en && media.title_en !== primaryTitle) return media.title_en;
  if (media.title_ar && media.title_ar !== primaryTitle) return media.title_ar;
  const orig = media.original_title || media.original_name;
  if (orig && orig !== primaryTitle) return orig;
  return undefined;
}
