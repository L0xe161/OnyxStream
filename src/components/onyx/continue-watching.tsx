"use client";

import { useRef } from "react";
import { Play, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useOnyxStore } from "@/lib/store";
import { getT } from "@/lib/i18n";
import { clearContinueWithUndo, removeContinueWithUndo } from "@/lib/actions";
import { transition } from "@/lib/motion";
import { useDragScroll } from "@/hooks/use-drag-scroll";
import { TmdbImage } from "./tmdb-image";
import type { Language, TMDBMediaItem } from "@/lib/types";

interface ContinueWatchingProps {
  lang: Language;
  onPlay: (media: TMDBMediaItem, season?: number, episode?: number, serverId?: string) => void;
}

export function ContinueWatching({ lang, onPlay }: ContinueWatchingProps) {
  const t = getT(lang);
  const items = useOnyxStore((s) => s.continueWatching);
  const listRef = useRef<HTMLUListElement>(null);
  const drag = useDragScroll<HTMLUListElement>(listRef);

  if (items.length === 0) return null;

  return (
    <section aria-label={t.continueWatching}>
      <div className="mb-[var(--space-row)] flex items-end justify-between gap-4">
        <h2 className="font-display text-title font-medium">{t.continueWatching}</h2>
        <button type="button" onClick={clearContinueWithUndo} className="rounded-full px-3 py-1.5 text-meta text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2">
          {t.clearHistory}
        </button>
      </div>

      <ul ref={listRef} onPointerDown={drag.onPointerDown} onPointerMove={drag.onPointerMove} onPointerUp={drag.onPointerUp} onPointerCancel={drag.onPointerCancel} className="drag-scroll -mx-[var(--gutter)] flex snap-x snap-proximity gap-4 overflow-x-auto overscroll-x-contain scroll-ps-[var(--gutter)] px-[var(--gutter)] pb-2 scrollbar-none">
        <AnimatePresence initial={false} mode="popLayout">
          {items.map((item) => {
            const title = item.media.title || item.media.name || "";
            const isTv = item.media.media_type === "tv" || !!item.media.first_air_date;
            const percent = Math.round(item.progress * 100);
            const where = isTv ? `${t.seasonShort}${item.season} · ${t.episodeShort}${item.episode}` : t.mediaMovie;

            return (
              <motion.li
                key={item.media.id}
                layout="position"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1, transition: transition.base }}
                exit={{ opacity: 0, scale: 0.96, transition: transition.fast }}
                className="group relative w-[min(78vw,20rem)] shrink-0 snap-start"
              >
                <button type="button" onClick={() => onPlay(item.media, item.season, item.episode, item.serverId)} aria-label={`${t.resumeAt}: ${title}, ${where}${percent > 0 ? `, ${percent}% ${t.watchedPercent}` : ""}`} className="relative block w-full overflow-hidden rounded-[var(--radius-lg)] text-start focus-visible:outline-2 focus-visible:outline-offset-2">
                  <TmdbImage path={item.media.backdrop_path || item.media.poster_path} kind="backdrop" alt={title} decorative sizes="(min-width:640px) 20rem, 78vw" />
                  <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" aria-hidden />
                  <span className="absolute inset-x-3 bottom-4 flex items-end justify-between gap-3 text-white">
                    <span className="min-w-0">
                      <span className="block truncate font-display text-base font-medium" dir="auto">{title}</span>
                      <span className="block text-meta text-white/80 tabular-nums">{where}{percent > 0 && ` · ${percent}%`}</span>
                    </span>
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-black">
                      <Play className="size-4 fill-current rtl:-scale-x-100" aria-hidden />
                    </span>
                  </span>
                  <span className="absolute inset-x-0 bottom-0 h-1 bg-white/25" aria-hidden>
                    <span className="block h-full origin-left bg-[var(--primary)] rtl:origin-right" style={{ width: `${Math.max(percent, item.progress > 0 ? 3 : 0)}%` }} />
                  </span>
                </button>
                <button type="button" onClick={() => removeContinueWithUndo(item.media.id)} aria-label={`${t.removeFromContinue}: ${title}`} className="absolute end-2 top-2 grid size-9 place-items-center rounded-full bg-black/65 text-white transition-colors hover:bg-black/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                  <X className="size-4" aria-hidden />
                </button>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </section>
  );
}
