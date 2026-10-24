"use client";

import { motion } from "framer-motion";
import { useOnyxStore } from "@/lib/store";
import { useGenreResults, useAllGenres } from "@/hooks/use-tmdb";
import { getT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { MediaCard } from "./media-card";
import { GridSkeleton } from "./skeletons";
import type { Language, TMDBGenre, TMDBMediaItem } from "@/lib/types";

interface GenreBrowserProps {
  genres: { movie: TMDBGenre[]; tv: TMDBGenre[] };
  lang: Language;
  bilingual?: boolean;
  onPlay: (media: TMDBMediaItem) => void;
  onSelectDetails: (media: TMDBMediaItem) => void;
}

const POPULAR_GENRE_IDS = [28, 35, 18, 10749, 27, 53, 12, 16, 80, 9648, 878, 14, 10402, 10751, 36, 99];

const chip = "h-9 rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2";

export function GenreBrowser({ genres, lang, bilingual = false, onPlay, onSelectDetails }: GenreBrowserProps) {
  const t = getT(lang);
  const artworkLang = useOnyxStore((s) => s.artworkLang);
  const selectedGenreId = useOnyxStore((s) => s.selectedGenreId);
  const setSelectedGenreId = useOnyxStore((s) => s.setSelectedGenreId);

  const allGenres = useAllGenres(genres);
  // A curated popular subset first, then everything else.
  const popular = POPULAR_GENRE_IDS.flatMap((id) => allGenres.filter((g) => g.id === id));
  const ordered = [...popular, ...allGenres.filter((g) => !POPULAR_GENRE_IDS.includes(g.id))];

  // Most genres overlap; animation and sci-fi/fantasy TV are the exceptions.
  const type: "movie" | "tv" = selectedGenreId === 16 || selectedGenreId === 10765 ? "tv" : "movie";
  const { results, loading } = useGenreResults(selectedGenreId, type, lang, artworkLang);

  return (
    <section aria-label={t.genres} className="space-y-5">
      <h2 className="font-display text-title font-medium">{t.genres}</h2>

      <div className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={selectedGenreId === null} onClick={() => setSelectedGenreId(null)} className={cn(chip, selectedGenreId === null ? "bg-foreground text-background" : "bg-muted text-foreground/85 hover:text-foreground")}>
          {t.allGenres}
        </button>
        {ordered.map((g) => {
          const active = selectedGenreId === g.id;
          return (
            <button key={g.id} type="button" aria-pressed={active} onClick={() => setSelectedGenreId(active ? null : g.id)} className={cn(chip, active ? "bg-foreground text-background" : "bg-muted text-foreground/85 hover:text-foreground")}>
              {g.name}
            </button>
          );
        })}
      </div>

      {selectedGenreId && (
        <motion.div key={selectedGenreId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} aria-live="polite">
          {loading ? (
            <GridSkeleton count={12} />
          ) : results.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(var(--poster-w),1fr))] gap-x-4 gap-y-8">
              {results.map((item) => (
                <MediaCard key={`${item.id}-${item.media_type}`} media={item} lang={lang} bilingual={bilingual} onPlay={onPlay} onSelectDetails={onSelectDetails} />
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-muted-foreground">{t.searchEmpty}</p>
          )}
        </motion.div>
      )}
    </section>
  );
}
