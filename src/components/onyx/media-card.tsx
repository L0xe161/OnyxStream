"use client";

import { memo } from "react";
import { Heart, Star } from "lucide-react";
import { getBilingualOtherTitle } from "@/lib/tmdb";
import { useOnyxStore } from "@/lib/store";
import { getT } from "@/lib/i18n";
import { toggleFavoriteWithUndo } from "@/lib/actions";
import { TmdbImage } from "./tmdb-image";
import { cn } from "@/lib/utils";
import type { Language, TMDBMediaItem } from "@/lib/types";

interface MediaCardProps {
  media: TMDBMediaItem;
  lang: Language;
  bilingual?: boolean;
  /** Kept for call-site compatibility; the card itself no longer plays directly. */
  onPlay?: (media: TMDBMediaItem) => void;
  onSelectDetails: (media: TMDBMediaItem) => void;
  /** Warm the cache for the details modal when the pointer or focus arrives. */
  onPrefetch?: (media: TMDBMediaItem) => void;
}

/** Visible on touch and under keyboard focus; revealed on hover only where hover exists. */
const reveal =
  "opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100";

function MediaCardBase({ media, lang, bilingual = false, onSelectDetails, onPrefetch }: MediaCardProps) {
  const t = getT(lang);
  const isFavorite = useOnyxStore((s) => s.favorites.some((f) => f.id === media.id));

  const title = media.title || media.name || "";
  const otherTitle = getBilingualOtherTitle(media, title);
  const year = (media.release_date || media.first_air_date || "").slice(0, 4);
  const rating = media.vote_average > 0 ? media.vote_average.toFixed(1) : null;
  const isTv = media.media_type === "tv" || !!media.first_air_date;
  const kindLabel = isTv ? t.mediaSeries : t.mediaMovie;

  return (
    <article className="group relative flex flex-col gap-2" onPointerEnter={() => onPrefetch?.(media)} onFocus={() => onPrefetch?.(media)}>
      {/* One unified target: the entire card body — poster, titles and meta —
          opens the details view, where playback is started from "ENJOY". */}
      <button
        type="button"
        onClick={() => onSelectDetails(media)}
        aria-label={`${t.moreInfo}: ${title}`}
        className="absolute inset-0 z-10 rounded-[var(--radius-lg)] focus-visible:outline-2 focus-visible:outline-offset-2"
      />

      <div className="relative transition-transform duration-300 ease-[var(--ease-standard)] [@media(hover:hover)]:group-hover:-translate-y-1 [@media(hover:hover)]:group-focus-within:-translate-y-1 motion-reduce:transform-none">
        <div className="overflow-hidden rounded-[var(--radius-lg)]">
          <TmdbImage path={media.poster_path} kind="poster" alt={title} decorative sizes="(min-width:1024px) 13rem, (min-width:640px) 11rem, 9rem" />
        </div>

        {/* Quick favorite toggle: a heart in the top-end corner, visible on
            touch and under focus, revealed on hover for pointer devices.
            Toggles favorite without leaving the grid (no details page needed). */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); toggleFavoriteWithUndo(media); }}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? t.removeFromFavorites : t.addToFavorites}
          className={cn(
            "absolute end-2 top-2 z-20 grid size-9 place-items-center rounded-full text-white transition-all hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
            isFavorite ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "bg-black/65 hover:bg-black/85",
            reveal
          )}
        >
          <Heart className={cn("size-4", isFavorite && "fill-current")} aria-hidden />
        </button>

        <div className={cn("pointer-events-none absolute inset-0 z-10 flex flex-col justify-end rounded-[var(--radius-lg)] bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 text-white transition-opacity duration-200", reveal)}>
          <p className="line-clamp-2 font-display text-[0.9rem] font-medium leading-snug" dir="auto">{title}</p>
          {rating && (
            <p className="mt-1 flex items-center gap-1 text-[0.8125rem] tabular-nums">
              <Star className="size-3 fill-current" aria-hidden />
              <span className="sr-only">{t.rating}</span>
              {rating}
            </p>
          )}
        </div>
      </div>

      <div className="min-w-0">
        <h3 className="line-clamp-1 font-display text-[0.95rem] font-medium leading-snug tracking-tight" title={title} dir="auto">
          {title}
        </h3>
        {bilingual && otherTitle && otherTitle !== title && (
          <p className="line-clamp-1 text-[0.8125rem] text-muted-foreground" dir="auto" title={otherTitle}>
            {otherTitle}
          </p>
        )}
        <p className="mt-0.5 flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground tabular-nums">
          <span>{year || "—"}</span>
          <span aria-hidden>·</span>
          <span>{kindLabel}</span>
          {rating && (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-0.5">
                <Star className="size-3 fill-current" aria-hidden />
                <span className="sr-only">{t.rating}</span>
                {rating}
              </span>
            </>
          )}
        </p>
      </div>
    </article>
  );
}

export const MediaCard = memo(MediaCardBase);
