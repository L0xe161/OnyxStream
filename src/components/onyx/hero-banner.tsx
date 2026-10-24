"use client";

import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { Heart, Info, Pause, Play, Star } from "lucide-react";
import { getBilingualOtherTitle } from "@/lib/tmdb";
import { useOnyxStore } from "@/lib/store";
import { dirFor, getT } from "@/lib/i18n";
import { toggleFavoriteWithUndo } from "@/lib/actions";
import { rise, stagger, duration, ease } from "@/lib/motion";
import { useMotion } from "@/hooks/use-motion";
import { useArtworkAccent } from "@/hooks/use-artwork-accent";
import { TmdbImage } from "./tmdb-image";
import { cn } from "@/lib/utils";
import type { Language, TMDBMediaItem } from "@/lib/types";

interface HeroBannerProps {
  items: TMDBMediaItem[];
  lang: Language;
  bilingual?: boolean;
  onPlay: (media: TMDBMediaItem) => void;
  onSelectDetails: (media: TMDBMediaItem) => void;
}

const MAX_SLIDES = 6;
const SWIPE_DISTANCE = 60;
const SWIPE_VELOCITY = 400;

const pill = "inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-[0.9375rem] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2";
const iconPill = "grid size-12 place-items-center rounded-full bg-foreground/10 text-foreground transition-colors hover:bg-foreground/20 focus-visible:outline-2 focus-visible:outline-offset-2";

export function HeroBanner({ items, lang, bilingual = false, onPlay, onSelectDetails }: HeroBannerProps) {
  const t = getT(lang);
  const dir = dirFor(lang);
  const { reduced } = useMotion();
  const intervalMs = useOnyxStore((s) => s.settings.heroIntervalMs);
  const autoplay = useOnyxStore((s) => s.settings.heroAutoplay);

  const slides = useMemo(
    () => items.filter((m) => m.backdrop_path || m.poster_path).slice(0, MAX_SLIDES),
    [items]
  );
  const [index, setIndex] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  const current = slides[Math.min(index, Math.max(slides.length - 1, 0))];
  const isFavorite = useOnyxStore((s) => !!current && s.favorites.some((f) => f.id === current.id));
  const accent = useArtworkAccent(current?.backdrop_path ?? current?.poster_path);

  // Auto-advance never runs under reduced motion (WCAG 2.2.2) or when the user opts out.
  const running = autoplay && !reduced && slides.length > 1;
  const paused = userPaused || hovered || focused;

  const go = useCallback(
    (next: number) => setIndex(((next % slides.length) + slides.length) % slides.length),
    [slides.length]
  );

  const onDragEnd = (_: unknown, info: PanInfo) => {
    // Swiping toward the inline-start reveals the next slide, mirrored in RTL.
    const towardsNext = dir === "rtl" ? info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY : info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY;
    const towardsPrev = dir === "rtl" ? info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY : info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY;
    if (towardsNext) go(index + 1);
    else if (towardsPrev) go(index - 1);
  };

  if (!current) return null;

  const title = current.title || current.name || "";
  const other = bilingual ? getBilingualOtherTitle(current, title) : null;
  const year = (current.release_date || current.first_air_date || "").slice(0, 4);
  const rating = current.vote_average > 0 ? current.vote_average.toFixed(1) : null;
  const isTv = current.media_type === "tv" || !!current.first_air_date;
  const variants = rise(reduced);

  return (
    <section
      aria-roledescription="carousel"
      aria-label={t.featured}
      style={accent.style as React.CSSProperties}
      className="relative isolate min-h-[clamp(26rem,74svh,54rem)] overflow-hidden"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setFocused(false)}
    >
      <AnimatePresence initial={false}>
        <motion.div
          key={current.id}
          className={cn("absolute inset-0 -z-10", !reduced && "hero-art")}
          style={{ "--hero-drift": `${Math.round(intervalMs * 1.6)}ms` } as React.CSSProperties}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: duration.slow, ease: ease.standard }}
        >
          <TmdbImage
            path={current.backdrop_path ?? current.poster_path}
            kind="backdrop"
            alt=""
            decorative
            priority={index === 0}
            sizes="100vw"
            className="!aspect-auto size-full"
          />
          <div className="onyx-fade-bottom absolute inset-0" />
          <div className="onyx-fade-inline absolute inset-0" />
        </motion.div>
      </AnimatePresence>

      <motion.div
        className="flex min-h-[inherit] flex-col justify-end px-[var(--gutter)] pb-14 pt-24 sm:pb-16"
        drag={slides.length > 1 ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.15}
        onDragEnd={onDragEnd}
        style={{ touchAction: "pan-y" }}
      >
        <motion.div key={current.id} variants={stagger(0.05)} initial="hidden" animate="visible" className="max-w-3xl" aria-live={running && !paused ? "off" : "polite"}>
          <motion.p variants={variants} className="mb-3 flex items-center gap-2 text-meta text-muted-foreground tabular-nums">
            <span>{isTv ? t.mediaSeries : t.mediaMovie}</span>
            {year && (<><span aria-hidden>·</span><span>{year}</span></>)}
            {rating && (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1"><Star className="size-3.5 fill-current" aria-hidden /><span className="sr-only">{t.rating}</span>{rating}</span>
              </>
            )}
          </motion.p>

          <motion.h1 variants={variants} className="font-display text-display text-balance" dir="auto">
            {title}
          </motion.h1>
          {other && other !== title && (
            <motion.p variants={variants} className="mt-2 text-title text-muted-foreground" dir="auto">{other}</motion.p>
          )}

          {current.overview && (
            <motion.p variants={variants} className="mt-5 line-clamp-3 max-w-xl text-body text-foreground/90" dir="auto">
              {current.overview}
            </motion.p>
          )}

          <motion.div variants={variants} className="mt-7 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => onPlay(current)} className={cn(pill, "bg-[var(--title-accent,var(--primary))] text-[var(--title-accent-ink,var(--primary-foreground))] hover:brightness-110 focus-visible:outline-[var(--title-accent,var(--primary))]")}>
              <Play className="size-5 fill-current rtl:-scale-x-100" aria-hidden />
              {t.playNow}
            </button>
            <button type="button" onClick={() => onSelectDetails(current)} className={cn(pill, "bg-foreground/10 text-foreground hover:bg-foreground/20")}>
              <Info className="size-5" aria-hidden />
              {t.moreInfo}
            </button>
            <button type="button" onClick={() => toggleFavoriteWithUndo(current)} aria-pressed={isFavorite} aria-label={isFavorite ? t.removeFromFavorites : t.addToFavorites} className={iconPill}>
              <Heart className={cn("size-5", isFavorite && "fill-current")} aria-hidden />
            </button>
          </motion.div>
        </motion.div>
      </motion.div>

      {slides.length > 1 && (
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 px-[var(--gutter)] pb-5">
          <div role="group" aria-label={t.featured} className="flex flex-1 items-center gap-2">
            {slides.map((slide, i) => {
              const label = `${t.heroSlide} ${i + 1} ${t.heroOf} ${slides.length}: ${slide.title || slide.name || ""}`;
              const active = i === index;
              return (
                <button key={slide.id} type="button" onClick={() => go(i)} aria-label={label} aria-current={active ? "true" : undefined} className="group/seg relative h-6 max-w-16 flex-1 focus-visible:outline-2 focus-visible:outline-offset-2">
                  <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 overflow-hidden rounded-full bg-foreground/25 transition-[height] group-hover/seg:h-1">
                    <span
                      className={cn("absolute inset-0 origin-left rounded-full bg-foreground rtl:origin-right", active && !running && "scale-x-100", !active && i > index && "scale-x-0", !active && i < index && "scale-x-100")}
                      style={active && running ? { animation: `hero-progress ${intervalMs}ms linear forwards`, animationPlayState: paused ? "paused" : "running", transform: "scaleX(0)" } : undefined}
                      onAnimationEnd={() => active && running && go(index + 1)}
                    />
                  </span>
                </button>
              );
            })}
          </div>
          {running && (
            <button type="button" onClick={() => setUserPaused((v) => !v)} aria-label={userPaused ? t.heroPlay : t.heroPause} className="grid size-10 place-items-center rounded-full bg-foreground/10 text-foreground transition-colors hover:bg-foreground/20 focus-visible:outline-2 focus-visible:outline-offset-2">
              {userPaused ? <Play className="size-4 fill-current rtl:-scale-x-100" aria-hidden /> : <Pause className="size-4 fill-current" aria-hidden />}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
