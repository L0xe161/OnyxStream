"use client";

import { Loader2, Search as SearchIcon, Users, X } from "lucide-react";
import { Overlay, OverlayClose } from "./overlay";
import { MediaCard } from "./media-card";
import { TmdbImage } from "./tmdb-image";
import { useOnyxStore } from "@/lib/store";
import { useSearch } from "@/hooks/use-tmdb";
import { dirFor, getT } from "@/lib/i18n";
import type { TMDBMediaItem, TMDBSearchPersonResult } from "@/lib/types";

interface SearchOverlayProps {
  onClose: () => void;
  onPlay: (media: TMDBMediaItem) => void;
  onSelectDetails: (media: TMDBMediaItem) => void;
  onSelectPerson: (person: TMDBSearchPersonResult) => void;
}

export function SearchOverlay({ onClose, onPlay, onSelectDetails, onSelectPerson }: SearchOverlayProps) {
  const lang = useOnyxStore((s) => s.lang);
  const artworkLang = useOnyxStore((s) => s.artworkLang);
  const bilingual = useOnyxStore((s) => s.bilingual);
  const open = useOnyxStore((s) => s.isSearchOpen);
  const query = useOnyxStore((s) => s.searchQuery);
  const setQuery = useOnyxStore((s) => s.setSearchQuery);

  const t = getT(lang);
  const { results, people, loading } = useSearch(query, lang, artworkLang);
  const trimmed = query.trim();

  return (
    <Overlay open={open} onOpenChange={(o) => !o && onClose()} title={t.shortcutSearch} variant="modal" dir={dirFor(lang)} className="!max-w-6xl">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-3 px-6 pb-4 pt-6 sm:px-10">
          <div className="relative flex flex-1 items-center">
            <SearchIcon className="pointer-events-none absolute start-4 size-5 text-muted-foreground" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              aria-label={t.shortcutSearch}
              dir="auto"
              enterKeyHint="search"
              autoComplete="off"
              className="h-14 w-full rounded-full bg-muted ps-12 pe-12 text-[1.0625rem] outline-none placeholder:text-muted-foreground focus-visible:outline-2 [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label={t.clearField} className="absolute end-3 grid size-9 place-items-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-2">
                <X className="size-4" aria-hidden />
              </button>
            )}
          </div>
          <OverlayClose className="grid size-12 shrink-0 place-items-center rounded-full bg-muted hover:bg-secondary focus-visible:outline-2" aria-label={t.close}>
            <X className="size-5" aria-hidden />
          </OverlayClose>
        </div>

        <div className="min-h-0 flex-1 space-y-8 overflow-y-auto overscroll-contain px-6 pb-10 sm:px-10">
          <p role="status" aria-live="polite" className="flex items-center gap-2 text-meta text-muted-foreground tabular-nums">
            {loading ? (
              <><Loader2 className="size-4 animate-spin" aria-hidden />{t.searching}</>
            ) : trimmed ? (
              <>{t.found} {results.length} {t.results}{people.length > 0 && ` · ${people.length} ${t.people}`}</>
            ) : (
              t.searchShortcut
            )}
          </p>

          {people.length > 0 && (
            <section aria-label={t.people}>
              <h3 className="mb-3 flex items-center gap-2 text-meta text-muted-foreground"><Users className="size-4" aria-hidden />{t.people}</h3>
              <ul className="-mx-6 flex gap-4 overflow-x-auto px-6 pb-2 scrollbar-none sm:-mx-10 sm:px-10">
                {people.slice(0, 8).map((p) => (
                  <li key={p.id} className="w-24 shrink-0">
                    <button type="button" onClick={() => onSelectPerson(p)} className="group block w-full text-center focus-visible:outline-2">
                      <TmdbImage path={p.profile_path} kind="profile" alt={p.name} decorative sizes="6rem" className="mx-auto !size-24 !aspect-square rounded-full transition-transform group-hover:scale-[1.04]" />
                      <span className="mt-2 block line-clamp-1 text-meta font-medium" dir="auto">{p.name}</span>
                      <span className="block line-clamp-1 text-meta text-muted-foreground">{p.known_for_department}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {results.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(var(--poster-w),1fr))] gap-x-4 gap-y-8">
              {results.map((item) => (
                <MediaCard key={`${item.id}-${item.media_type}`} media={item} lang={lang} bilingual={bilingual} onPlay={(m) => { onPlay(m); onClose(); }} onSelectDetails={onSelectDetails} />
              ))}
            </div>
          ) : trimmed && !loading ? (
            <div className="space-y-1 py-16 text-center">
              <p className="font-display text-title" dir="auto">{t.searchEmpty} “{trimmed}”</p>
              <p className="text-muted-foreground">{t.searchTryAgain}</p>
            </div>
          ) : null}
        </div>
      </div>
    </Overlay>
  );
}
