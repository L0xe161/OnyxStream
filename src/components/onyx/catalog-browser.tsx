"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Film, Loader2, SlidersHorizontal, Tv, X } from "lucide-react";
import { Overlay, OverlayClose } from "./overlay";
import { MediaCard } from "./media-card";
import { GridSkeleton } from "./skeletons";
import { useOnyxStore } from "@/lib/store";
import { useAllGenres, useCatalogBrowse, usePrefetchDetails } from "@/hooks/use-tmdb";
import { dirFor, getT } from "@/lib/i18n";
import { ORIGINAL_LANGUAGES, SORT_OPTIONS } from "@/lib/tmdb";
import { applyContentFilters, watchedIds } from "@/lib/content-filters";
import { cn } from "@/lib/utils";
import type { CatalogFilters, Language, MediaType, SortOption, TMDBGenre, TMDBMediaItem } from "@/lib/types";

interface CatalogBrowserProps {
  genres: { movie: TMDBGenre[]; tv: TMDBGenre[] };
  lang: Language;
  bilingual: boolean;
  onPlay: (media: TMDBMediaItem) => void;
  onSelectDetails: (media: TMDBMediaItem) => void;
}

const POPULAR_GENRE_IDS = [28, 35, 18, 10749, 27, 53, 12, 16, 80, 9648, 878, 14, 10402, 10751, 36, 99, 10752, 37, 10770, 10759, 10765, 10768];
const CURRENT_YEAR = new Date().getFullYear();

const label = "mb-2 block text-meta font-medium text-muted-foreground";
const field = "h-10 w-full rounded-full bg-muted px-4 text-sm outline-none focus-visible:outline-2";
const chip = "h-8 rounded-full px-3 text-[0.8125rem] font-medium transition-colors focus-visible:outline-2";

export function CatalogBrowser({ genres, lang, bilingual, onPlay, onSelectDetails }: CatalogBrowserProps) {
  const t = getT(lang);
  const artworkLang = useOnyxStore((s) => s.artworkLang);
  const filters = useOnyxStore((s) => s.catalog);
  const setCatalog = useOnyxStore((s) => s.setCatalog);
  const resetCatalog = useOnyxStore((s) => s.resetCatalog);
  const settings = useOnyxStore((s) => s.settings);
  const history = useOnyxStore((s) => s.continueWatching);
  const prefetch = usePrefetchDetails(lang, artworkLang);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  const allGenres = useAllGenres(genres);
  const ordered = useMemo(() => {
    const popular = POPULAR_GENRE_IDS.flatMap((id) => allGenres.filter((g) => g.id === id));
    return [...popular, ...allGenres.filter((g) => !POPULAR_GENRE_IDS.includes(g.id))];
  }, [allGenres]);

  const { type, genreIds, yearFrom, yearTo, minRating, originalLanguage, sortBy } = filters;

  // TV has no primary_release_date; map the release-date sorts to first_air_date.
  const effectiveSort: SortOption =
    type === "tv" && sortBy.startsWith("primary_release_date") ? (sortBy.endsWith("desc") ? "first_air_date.desc" : "first_air_date.asc") : sortBy;

  // The user's preferred region (first selected) is sent to TMDB discover as
  // the `region` param, which affects release-date availability and ordering.
  const preferredRegion = settings.preferredRegions[0];
  const query: CatalogFilters = { type, genreIds, yearFrom, yearTo, minRating: minRating || undefined, originalLanguage: originalLanguage || undefined, region: preferredRegion, sortBy: effectiveSort, page: 1 };
  const { items, loading, page, totalPages, totalResults, loadMore } = useCatalogBrowse(query, lang, artworkLang);

  const visible = useMemo(() => applyContentFilters(items, settings, watchedIds(history)), [items, settings, history]);
  const activeCount = genreIds.length + (yearFrom ? 1 : 0) + (yearTo ? 1 : 0) + (minRating > 0 ? 1 : 0) + (originalLanguage ? 1 : 0);
  const hasMore = page < totalPages;

  // Infinite scroll; the "Load more" button below stays as the fallback.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || loading) return;
    const observer = new IntersectionObserver((entries) => entries[0]?.isIntersecting && loadMore(), { rootMargin: "800px 0px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, loadMore, items.length]);

  const toggleGenre = (id: number) => setCatalog({ genreIds: genreIds.includes(id) ? genreIds.filter((g) => g !== id) : [...genreIds, id] });
  const typeLabel = (mt: MediaType) => (mt === "movie" ? t.navMovies : t.navTV);

  const panel = (
    <div className="space-y-6">
      <div>
        <span className={label}>{t.type}</span>
        <div role="radiogroup" aria-label={t.type} className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
          {(["movie", "tv"] as MediaType[]).map((mt) => (
            <button key={mt} type="button" role="radio" aria-checked={type === mt} onClick={() => setCatalog({ type: mt })} className={cn("flex h-9 items-center justify-center gap-1.5 rounded-full text-sm font-medium transition-colors focus-visible:outline-2", type === mt ? "bg-foreground text-background" : "text-foreground/80 hover:text-foreground")}>
              {mt === "movie" ? <Film className="size-4" aria-hidden /> : <Tv className="size-4" aria-hidden />}
              {typeLabel(mt)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className={label}>{t.genres}</span>
        <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto scrollbar-none">
          {ordered.map((g) => {
            const on = genreIds.includes(g.id);
            return <button key={g.id} type="button" aria-pressed={on} onClick={() => toggleGenre(g.id)} className={cn(chip, on ? "bg-foreground text-background" : "bg-muted text-foreground/85 hover:text-foreground")}>{g.name}</button>;
          })}
        </div>
      </div>

      <fieldset>
        <legend className={label}>{t.yearFrom} / {t.yearTo}</legend>
        <div className="grid grid-cols-2 gap-2">
          <input type="number" inputMode="numeric" min={1900} max={CURRENT_YEAR + 1} placeholder="1900" aria-label={t.yearFrom} value={yearFrom ?? ""} onChange={(e) => setCatalog({ yearFrom: e.target.value ? Number(e.target.value) : undefined })} className={cn(field, "tabular-nums")} />
          <input type="number" inputMode="numeric" min={1900} max={CURRENT_YEAR + 1} placeholder={String(CURRENT_YEAR)} aria-label={t.yearTo} value={yearTo ?? ""} onChange={(e) => setCatalog({ yearTo: e.target.value ? Number(e.target.value) : undefined })} className={cn(field, "tabular-nums")} />
        </div>
      </fieldset>

      <div>
        <label htmlFor="catalog-rating" className={label}>{t.minRating}: <span className="font-semibold text-foreground tabular-nums">{minRating.toFixed(1)}</span></label>
        <input id="catalog-rating" type="range" min={0} max={9} step={0.5} value={minRating} onChange={(e) => setCatalog({ minRating: Number(e.target.value) })} className="w-full accent-[var(--primary)]" />
      </div>

      <div>
        <label htmlFor="catalog-lang" className={label}>{t.originalLanguage}</label>
        <select id="catalog-lang" value={originalLanguage} onChange={(e) => setCatalog({ originalLanguage: e.target.value })} className={field}>
          <option value="">{t.anyLanguage}</option>
          {ORIGINAL_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{lang === "ar" ? l.labelAr : l.label}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor="catalog-sort" className={label}>{t.sortBy}</label>
        <select id="catalog-sort" value={sortBy} onChange={(e) => setCatalog({ sortBy: e.target.value as SortOption })} className={field}>
          {SORT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{lang === "ar" ? s.labelAr : s.label}</option>)}
        </select>
      </div>

      {activeCount > 0 && (
        <button type="button" onClick={resetCatalog} className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-muted text-sm font-semibold hover:bg-secondary focus-visible:outline-2">
          <X className="size-4" aria-hidden />
          {t.clear} ({activeCount})
        </button>
      )}
    </div>
  );

  return (
    <section aria-label={t.catalogTitle} className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-headline">{t.catalogTitle}</h1>
        <div className="flex items-center gap-3 text-muted-foreground">
          <span className="tabular-nums" aria-live="polite">{totalResults > 0 ? `${totalResults.toLocaleString(lang)} ${t.results}` : ""}</span>
          <button type="button" onClick={() => setFiltersOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-full bg-muted px-4 text-sm font-medium text-foreground focus-visible:outline-2 lg:hidden">
            <SlidersHorizontal className="size-4" aria-hidden />
            {t.filters}
            {activeCount > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-[var(--primary)] px-1.5 text-[0.6875rem] font-semibold tabular-nums text-[var(--primary-foreground)]">{activeCount}</span>}
          </button>
        </div>
      </div>

      <div className="flex gap-10">
        <aside aria-label={t.filters} className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-24 rounded-[var(--radius-xl)] bg-card p-5">{panel}</div>
        </aside>

        <div className="min-w-0 flex-1">
          {loading && items.length === 0 ? (
            <GridSkeleton count={18} />
          ) : visible.length > 0 ? (
            <>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(var(--poster-w),1fr))] gap-x-4 gap-y-8">
                {visible.map((item) => (
                  <div key={`${item.id}-${item.media_type}`} className="[contain-intrinsic-size:auto_22rem] [content-visibility:auto]">
                    <MediaCard media={item} lang={lang} bilingual={bilingual} onPlay={onPlay} onSelectDetails={onSelectDetails} onPrefetch={prefetch} />
                  </div>
                ))}
              </div>
              {hasMore && (
                <div ref={sentinel} className="flex flex-col items-center py-10">
                  <button type="button" onClick={loadMore} disabled={loading} className="inline-flex h-12 items-center gap-2 rounded-full bg-muted px-6 font-semibold hover:bg-secondary focus-visible:outline-2 disabled:opacity-60">
                    {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ChevronDown className="size-4" aria-hidden />}
                    {loading ? t.searching : t.loadMore}
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="py-24 text-center text-muted-foreground">{t.noResults}</p>
          )}
        </div>
      </div>

      <Overlay open={filtersOpen} onOpenChange={setFiltersOpen} title={t.filters} variant="sheet" dir={dirFor(lang)} className="lg:hidden">
        <div className="flex items-center justify-between px-6 pt-6">
          <h2 className="font-display text-title">{t.filters}</h2>
          <OverlayClose className="grid size-10 place-items-center rounded-full hover:bg-muted focus-visible:outline-2" aria-label={t.close}><X className="size-5" aria-hidden /></OverlayClose>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{panel}</div>
        <div className="px-6 pb-6">
          <OverlayClose className="h-12 w-full rounded-full bg-[var(--primary)] font-semibold text-[var(--primary-foreground)] focus-visible:outline-2 focus-visible:outline-offset-2">{t.apply}</OverlayClose>
        </div>
      </Overlay>
    </section>
  );
}
