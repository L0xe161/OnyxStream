"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchTrending,
  fetchPopularMovies,
  fetchPopularTV,
  fetchAnime,
  fetchCartoons,
  fetchTopRated,
  fetchUpcoming,
  fetchGenres,
  fetchByGenre,
  fetchDetails,
  fetchSeasonDetails,
  searchMulti,
  searchMultiWithPeople,
  discoverMedia,
  fetchPerson,
  fetchPersonCredits,
} from "@/lib/tmdb";
import type {
  CatalogData,
  TMDBMediaItem,
  TMDBSeasonDetails,
  TMDBGenre,
  MediaType,
  ArtworkLanguage,
  Language,
  CatalogFilters,
  TMDBPerson,
  TMDBPersonCredits,
  TMDBSearchPersonResult,
} from "@/lib/types";
import { useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { useDebounce } from "./use-debounce";

/**
 * Merge an "other language" title/overview into a primary item so the card can
 * display both languages when bilingual mode is on. We fetch the EN list and
 * the AR list separately, then merge by id.
 */
function mergeBilingual(primary: TMDBMediaItem[], other: TMDBMediaItem[], otherLang: "en" | "ar"): TMDBMediaItem[] {
  const otherMap = new Map<number, TMDBMediaItem>();
  for (const o of other) otherMap.set(o.id, o);
  return primary.map((item) => {
    const o = otherMap.get(item.id);
    if (!o) return item;
    const titleKey = `title_${otherLang}` as const;
    const nameKey = `name_${otherLang}` as const;
    const overviewKey = `overview_${otherLang}` as const;
    return {
      ...item,
      [titleKey]: o.title ?? o.original_title,
      [nameKey]: o.name ?? o.original_name,
      [overviewKey]: o.overview,
    } as TMDBMediaItem;
  });
}

interface CatalogState {
  data: CatalogData | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useCatalog(
  lang: Language,
  artworkLang: ArtworkLanguage,
  bilingual: boolean
): CatalogState {
  const [data, setData] = useState<CatalogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const opts = { artworkLang, uiLang: lang };
        // For the bilingual "other" fetch, force the language to the OPPOSITE
        // artwork language (don't let uiLang re-trigger the Arabic branch in
        // buildParams). We merge by the artwork-language key so cards can show
        // both EN + AR titles regardless of the active UI language.
        const otherArtwork: ArtworkLanguage = artworkLang === "en" ? "ar" : "en";
        const otherOpts = { artworkLang: otherArtwork, uiLang: otherArtwork };

        const results = await Promise.all([
          fetchTrending(opts),
          fetchPopularMovies(opts),
          fetchPopularTV(opts),
          fetchAnime(opts),
          fetchCartoons(opts),
          fetchTopRated("movie", opts),
          fetchTopRated("tv", opts),
          fetchUpcoming(opts),
          fetchGenres(opts),
        ]);
        const [trending, movies, tvShows, anime, cartoons, topRatedMovies, topRatedTV, upcoming, genres] = results;

        // When bilingual is on, fetch the other-language versions and merge titles.
        let mergedTrending = trending;
        let mergedMovies = movies;
        let mergedTV = tvShows;
        let mergedAnime = anime;
        let mergedCartoons = cartoons;
        let mergedTopMovies = topRatedMovies;
        let mergedTopTV = topRatedTV;
        let mergedUpcoming = upcoming;
        if (bilingual) {
          const other = await Promise.all([
            fetchTrending(otherOpts),
            fetchPopularMovies(otherOpts),
            fetchPopularTV(otherOpts),
            fetchAnime(otherOpts),
            fetchCartoons(otherOpts),
            fetchTopRated("movie", otherOpts),
            fetchTopRated("tv", otherOpts),
            fetchUpcoming(otherOpts),
          ]);
          mergedTrending = mergeBilingual(trending, other[0], otherArtwork);
          mergedMovies = mergeBilingual(movies, other[1], otherArtwork);
          mergedTV = mergeBilingual(tvShows, other[2], otherArtwork);
          mergedAnime = mergeBilingual(anime, other[3], otherArtwork);
          mergedCartoons = mergeBilingual(cartoons, other[4], otherArtwork);
          mergedTopMovies = mergeBilingual(topRatedMovies, other[5], otherArtwork);
          mergedTopTV = mergeBilingual(topRatedTV, other[6], otherArtwork);
          mergedUpcoming = mergeBilingual(upcoming, other[7], otherArtwork);
        }

        if (cancelled) return;
        setData({
          trending: mergedTrending,
          movies: mergedMovies,
          tvShows: mergedTV,
          anime: mergedAnime,
          cartoons: mergedCartoons,
          topRatedMovies: mergedTopMovies,
          topRatedTV: mergedTopTV,
          upcoming: mergedUpcoming,
          genres,
        });
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load catalog:", err);
        setError("Failed to load catalog. Please retry.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [lang, artworkLang, bilingual, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, loading, error, reload };
}

interface SearchState {
  results: TMDBMediaItem[];
  people: TMDBSearchPersonResult[];
  loading: boolean;
}

export function useSearch(query: string, lang: Language, artworkLang: ArtworkLanguage): SearchState {
  const debounced = useDebounce(query.trim(), 350);
  const [results, setResults] = useState<TMDBMediaItem[]>([]);
  const [people, setPeople] = useState<TMDBSearchPersonResult[]>([]);
  const [loading, setLoading] = useState(false);
  const reqIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!debounced) {
        setResults([]);
        setPeople([]);
        setLoading(false);
        return;
      }
      const myId = ++reqIdRef.current;
      setLoading(true);
      try {
        const res = await searchMultiWithPeople(debounced, { artworkLang, uiLang: lang });
        if (myId !== reqIdRef.current || cancelled) return;
        setResults(res.media);
        setPeople(res.people);
      } catch {
        if (myId !== reqIdRef.current || cancelled) return;
        setResults([]);
        setPeople([]);
      } finally {
        if (myId === reqIdRef.current && !cancelled) setLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [debounced, lang, artworkLang]);

  return { results, people, loading };
}

interface DetailsState {
  details: TMDBMediaItem | null;
  loading: boolean;
}

const DETAILS_STALE_MS = 10 * 60_000;

const mediaTypeOf = (media: TMDBMediaItem): MediaType =>
  media.media_type === "tv" || !!media.first_air_date ? "tv" : "movie";

/** One cache key for modal reads and hover prefetches, so they share the same request. */
function detailsQuery(media: TMDBMediaItem, lang: Language, artworkLang: ArtworkLanguage) {
  const type = mediaTypeOf(media);
  return {
    queryKey: ["details", type, media.id, lang, artworkLang] as const,
    staleTime: DETAILS_STALE_MS,
    queryFn: async () => (await fetchDetails(media.id, type, { artworkLang, uiLang: lang })) ?? media,
  };
}

export function useDetails(
  media: TMDBMediaItem | null,
  lang: Language,
  artworkLang: ArtworkLanguage
): DetailsState {
  // Build a single, consistently-typed options object. When there is no media
  // we still need a queryKey so the hook stays stable; we disable fetching and
  // return a placeholder via queryFn. This avoids a union of queryKey shapes
  // that TanStack Query v5 cannot reconcile.
  const options = useMemo<UseQueryOptions<TMDBMediaItem | null, Error, TMDBMediaItem | null, readonly unknown[]>>(
    () =>
      media
        ? {
            queryKey: ["details", mediaTypeOf(media), media.id, lang, artworkLang],
            staleTime: DETAILS_STALE_MS,
            queryFn: async () => (await fetchDetails(media.id, mediaTypeOf(media), { artworkLang, uiLang: lang })) ?? media,
          }
        : { queryKey: ["details", "none"], queryFn: () => null },
    [media, lang, artworkLang]
  );
  const query = useQuery({ ...options, enabled: !!media });
  return { details: media ? (query.data as TMDBMediaItem | undefined) ?? null : null, loading: !!media && query.isFetching && !query.data };
}

/** Returns a debounced prefetcher; call it when a card is hovered or focused. */
export function usePrefetchDetails(lang: Language, artworkLang: ArtworkLanguage) {
  const client = useQueryClient();
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return useCallback(
    (media: TMDBMediaItem) => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void client.prefetchQuery(detailsQuery(media, lang, artworkLang)), 150);
    },
    [client, lang, artworkLang]
  );
}

interface SeasonState {
  season: TMDBSeasonDetails | null;
  loading: boolean;
}

export function useSeason(
  media: TMDBMediaItem | null,
  seasonNumber: number,
  lang: Language,
  artworkLang: ArtworkLanguage
): SeasonState {
  const [season, setSeason] = useState<TMDBSeasonDetails | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!media || !(media.media_type === "tv" || media.first_air_date)) {
        setSeason(null);
        return;
      }
      setLoading(true);
      try {
        const res = await fetchSeasonDetails(media.id, seasonNumber, { artworkLang, uiLang: lang });
        if (cancelled) return;
        setSeason(res);
      } catch {
        if (cancelled) return;
        setSeason(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [media, seasonNumber, lang, artworkLang]);

  return { season, loading };
}

interface GenreState {
  results: TMDBMediaItem[];
  loading: boolean;
}

export function useGenreResults(
  genreId: number | null,
  type: MediaType,
  lang: Language,
  artworkLang: ArtworkLanguage
): GenreState {
  const [results, setResults] = useState<TMDBMediaItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!genreId) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const res = await fetchByGenre(type, genreId, { artworkLang, uiLang: lang });
        if (cancelled) return;
        setResults(res);
      } catch {
        if (cancelled) return;
        setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [genreId, type, lang, artworkLang]);

  return { results, loading };
}

export function useAllGenres(genres: { movie: TMDBGenre[]; tv: TMDBGenre[] }): TMDBGenre[] {
  const seen = new Set<number>();
  const merged: TMDBGenre[] = [];
  for (const g of [...genres.movie, ...genres.tv]) {
    if (!seen.has(g.id)) {
      seen.add(g.id);
      merged.push(g);
    }
  }
  return merged;
}

interface CatalogBrowseState {
  items: TMDBMediaItem[];
  loading: boolean;
  page: number;
  totalPages: number;
  totalResults: number;
  loadMore: () => void;
  reset: () => void;
}

/**
 * Paginated catalog browse with full filtering (genre/year/rating/language/sort).
 * Fetches page N+1 and appends. Filters changes reset to page 1.
 */
export function useCatalogBrowse(
  filters: CatalogFilters,
  lang: Language,
  artworkLang: ArtworkLanguage
): CatalogBrowseState {
  const [items, setItems] = useState<TMDBMediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalPages, setTotalPages] = useState(0);
  const [totalResults, setTotalResults] = useState(0);
  const [appliedPage, setAppliedPage] = useState(filters.page);

  // Filter signature to detect changes.
  const sig = `${filters.type}|${filters.genreIds.join(",")}|${filters.yearFrom ?? ""}|${
    filters.yearTo ?? ""
  }|${filters.minRating ?? ""}|${filters.originalLanguage ?? ""}|${filters.region ?? ""}|${filters.sortBy}`;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const run = async () => {
      try {
        const data = await discoverMedia(filters, { artworkLang, uiLang: lang });
        if (cancelled) return;
        setItems(data.results);
        setTotalPages(data.total_pages);
        setTotalResults(data.total_results);
        setAppliedPage(data.page);
      } catch {
        if (cancelled) return;
        setItems([]);
        setTotalPages(0);
        setTotalResults(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [sig, lang, artworkLang]);

  const loadMore = () => {
    if (loading || appliedPage >= totalPages) return;
    const nextPage = appliedPage + 1;
    setLoading(true);
    discoverMedia({ ...filters, page: nextPage }, { artworkLang, uiLang: lang })
      .then((data) => {
        setItems((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          const merged = [...prev];
          for (const r of data.results) {
            if (!seen.has(r.id)) {
              merged.push(r);
              seen.add(r.id);
            }
          }
          return merged;
        });
        setAppliedPage(nextPage);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const reset = () => {
    setItems([]);
    setAppliedPage(1);
    setTotalPages(0);
    setTotalResults(0);
  };

  return { items, loading, page: appliedPage, totalPages, totalResults, loadMore, reset };
}

interface PersonState {
  person: TMDBPerson | null;
  credits: TMDBPersonCredits | null;
  loading: boolean;
}

export function usePerson(
  person: TMDBPerson | TMDBSearchPersonResult | null,
  lang: Language,
  artworkLang: ArtworkLanguage
): PersonState {
  const [personFull, setPersonFull] = useState<TMDBPerson | null>(null);
  const [credits, setCredits] = useState<TMDBPersonCredits | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!person) {
      setPersonFull(null);
      setCredits(null);
      return;
    }
    setLoading(true);
    const run = async () => {
      try {
        const [p, c] = await Promise.all([
          fetchPerson(person.id, { artworkLang, uiLang: lang }),
          fetchPersonCredits(person.id, { artworkLang, uiLang: lang }),
        ]);
        if (cancelled) return;
        setPersonFull(p);
        setCredits(c);
      } catch {
        if (cancelled) return;
        setPersonFull(null);
        setCredits(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [person, lang, artworkLang]);

  return { person: personFull, credits, loading };
}
