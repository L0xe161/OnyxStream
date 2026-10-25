"use client";

import { useRef, useState } from "react";
import { ChevronRight, ExternalLink, Heart, Info, Loader2, Play, Star, X } from "lucide-react";
import { Overlay, OverlayClose } from "./overlay";
import { MediaCard } from "./media-card";
import { TmdbImage } from "./tmdb-image";
import { formatRuntime, getBilingualOtherTitle } from "@/lib/tmdb";
import { useDetails, useSeason } from "@/hooks/use-tmdb";
import { useShowStructure } from "@/hooks/use-show-structure";
import { useArtworkAccent } from "@/hooks/use-artwork-accent";
import { useDragScroll } from "@/hooks/use-drag-scroll";
import { useOnyxStore } from "@/lib/store";
import { dirFor, getT } from "@/lib/i18n";
import { toggleFavoriteWithUndo } from "@/lib/actions";
import { cn } from "@/lib/utils";
import type { ArtworkLanguage, Language, TMDBMediaItem } from "@/lib/types";

interface MediaModalProps {
  media: TMDBMediaItem | null;
  onClose: () => void;
  onPlay: (media: TMDBMediaItem, season?: number, episode?: number) => void;
  lang: Language;
  artworkLang: ArtworkLanguage;
  bilingual?: boolean;
}

const pill = "inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-[0.9375rem] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2";
const iconPill = "grid size-12 place-items-center rounded-full bg-foreground/10 text-foreground transition-colors hover:bg-foreground/20 focus-visible:outline-2 focus-visible:outline-offset-2";

export function MediaModal({ media, onClose, ...rest }: MediaModalProps) {
  const t = getT(rest.lang);
  // Keep the last title mounted while the exit animation plays.
  const [held, setHeld] = useState(media);
  if (media && media !== held) setHeld(media);

  return (
    <Overlay open={!!media} onOpenChange={(o) => !o && onClose()} title={held?.title || held?.name || t.moreInfo} variant="modal" dir={dirFor(rest.lang)}>
      {held && <ModalBody key={held.id} media={held} onClose={onClose} {...rest} />}
    </Overlay>
  );
}

function ModalBody({ media, onClose, onPlay, lang, artworkLang, bilingual = false }: Omit<MediaModalProps, "media"> & { media: TMDBMediaItem }) {
  const t = getT(lang);
  const setActivePerson = useOnyxStore((s) => s.setActivePerson);
  const [selectedSeason, setSelectedSeason] = useState(1);
  // Drag-to-scroll for the Cast and More-Like-This carousels so a mouse drag
  // scrolls instead of selecting the photos / titles inside them.
  const castRef = useRef<HTMLUListElement>(null);
  const castScroll = useDragScroll<HTMLUListElement>(castRef);
  const recsRef = useRef<HTMLUListElement>(null);
  const recsScroll = useDragScroll<HTMLUListElement>(recsRef);

  const isTv = media.media_type === "tv" || !!media.first_air_date;
  const { details, loading } = useDetails(media, lang, artworkLang);
  const structure = useShowStructure(isTv ? media.id : undefined, lang);
  const { season, loading: seasonLoading } = useSeason(isTv ? media : null, selectedSeason, lang, artworkLang);

  const item = details ?? media;
  const isFavorite = useOnyxStore((s) => s.favorites.some((f) => f.id === item.id));
  const accent = useArtworkAccent(item.backdrop_path || item.poster_path);

  const title = item.title || item.name || t.moreInfo;
  const other = bilingual ? getBilingualOtherTitle(item, title) : null;
  const year = (item.release_date || item.first_air_date || "").slice(0, 4);
  const rating = item.vote_average > 0 ? item.vote_average.toFixed(1) : null;
  const runtime = formatRuntime(item.runtime || item.episode_run_time?.[0]);
  const seasonNumbers = structure.data?.length ? structure.data.map((s) => s.season_number) : Array.from({ length: Math.max(1, item.number_of_seasons ?? 1) }, (_, i) => i + 1);
  const cast = (item.credits?.cast ?? []).slice(0, 14);
  const directors = (item.credits?.crew ?? []).filter((c) => c.job === "Director");
  const creators = isTv && directors.length === 0 ? (item.created_by ?? []) : [];
  const creditPeople = directors.length > 0 ? directors : creators;
  const creditLabel = directors.length > 0 ? t.directedBy : t.createdBy;
  const recs = (item.recommendations?.results ?? item.similar?.results ?? []).filter((r) => r.poster_path || r.backdrop_path).slice(0, 12);
  const trailer = (item.videos?.results ?? []).find((v) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser"));

  const openPerson = (id: number, name: string, profile: string | null, dept: string) => {
    setActivePerson({ id, name, profile_path: profile, known_for_department: dept, media_type: "person" });
    onClose();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={accent.style as React.CSSProperties}>
      <OverlayClose className="absolute end-4 top-4 z-20 grid size-11 place-items-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-white" aria-label={t.close}>
        <X className="size-5" aria-hidden />
      </OverlayClose>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="relative isolate">
          <TmdbImage path={item.backdrop_path || item.poster_path} kind="backdrop" alt="" decorative priority sizes="(min-width:1024px) 64rem, 100vw" className="!aspect-auto h-[clamp(16rem,46svh,26rem)] w-full" />
          <div className="onyx-fade-bottom absolute inset-0" />
          <div className="absolute inset-x-0 bottom-0 px-6 pb-6 sm:px-10">
            <p className="mb-2 flex items-center gap-2 text-meta text-muted-foreground tabular-nums">
              <span>{isTv ? t.mediaSeries : t.mediaMovie}</span>
              {year && <><span aria-hidden>·</span><span>{year}</span></>}
              {runtime && <><span aria-hidden>·</span><span>{runtime}</span></>}
              {isTv && seasonNumbers.length > 0 && <><span aria-hidden>·</span><span>{seasonNumbers.length} {t.seasons}</span></>}
              {rating && <><span aria-hidden>·</span><span className="inline-flex items-center gap-1"><Star className="size-3.5 fill-current" aria-hidden /><span className="sr-only">{t.rating}</span>{rating}</span></>}
            </p>
            <h2 className="font-display text-[clamp(2rem,1.4rem+3vw,4rem)] font-medium leading-[0.98] tracking-[-0.035em] text-balance" dir="auto">{title}</h2>
            {other && other !== title && <p className="mt-1 text-title text-muted-foreground" dir="auto">{other}</p>}
          </div>
        </div>

        <div className="space-y-10 px-6 pb-10 pt-6 sm:px-10">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => { onPlay(item, isTv ? selectedSeason : undefined, isTv ? 1 : undefined); onClose(); }} className={cn(pill, "bg-[var(--title-accent,var(--primary))] text-[var(--title-accent-ink,var(--primary-foreground))] hover:brightness-110")}>
              <Play className="size-5 fill-current rtl:-scale-x-100" aria-hidden />
              {t.playNow}
            </button>
            <button type="button" onClick={() => toggleFavoriteWithUndo(item)} aria-pressed={isFavorite} aria-label={isFavorite ? t.removeFromFavorites : t.addToFavorites} className={iconPill}>
              <Heart className={cn("size-5", isFavorite && "fill-current")} aria-hidden />
            </button>
            {trailer && (
              <a href={`https://www.youtube.com/watch?v=${trailer.key}`} target="_blank" rel="noreferrer noopener" className={cn(pill, "bg-foreground/10 text-foreground hover:bg-foreground/20")}>
                <ExternalLink className="size-4" aria-hidden />
                {t.trailer}
              </a>
            )}
            {loading && <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label={t.loadingDetails} />}
          </div>

          <div className="grid gap-8 md:grid-cols-[1fr_auto]">
            <div className="max-w-2xl space-y-4">
              {item.tagline && <p className="font-display text-title italic text-muted-foreground" dir="auto">“{item.tagline}”</p>}
              <p className="text-body" dir="auto">{item.overview || t.noOverview}</p>
              {creditPeople.length > 0 && (
                <p className="text-muted-foreground">
                  {creditLabel}{" "}
                  {creditPeople.map((p, i) => (
                    <span key={p.id}>
                      {i > 0 && <span aria-hidden>{lang === "ar" ? "، " : ", "}</span>}
                      <button type="button" onClick={() => openPerson(p.id, p.name, p.profile_path, directors.length > 0 ? "Directing" : "Writing")} className="font-medium text-foreground underline decoration-1 underline-offset-4 hover:text-[var(--primary)] focus-visible:outline-2">
                        {p.name}
                      </button>
                    </span>
                  ))}
                </p>
              )}
            </div>
            {item.genres && item.genres.length > 0 && (
              <ul className="flex flex-wrap content-start gap-2 md:max-w-56 md:justify-end" aria-label={t.genres}>
                {item.genres.map((g) => <li key={g.id} className="rounded-full bg-muted px-3 py-1 text-meta text-foreground/90">{g.name}</li>)}
              </ul>
            )}
          </div>

          {cast.length > 0 && (
            <section aria-label={t.cast}>
              <h3 className="mb-4 font-display text-title">{t.cast}</h3>
              <ul ref={castRef} onPointerDown={castScroll.onPointerDown} onPointerMove={castScroll.onPointerMove} onPointerUp={castScroll.onPointerUp} onPointerCancel={castScroll.onPointerCancel} className="drag-scroll -mx-6 flex gap-4 overflow-x-auto px-6 pb-2 scrollbar-none sm:-mx-10 sm:px-10">
                {cast.map((c) => (
                  <li key={c.id} className="w-24 shrink-0">
                    <button type="button" onClick={() => openPerson(c.id, c.name, c.profile_path, "Acting")} className="group block w-full text-center focus-visible:outline-2">
                      <TmdbImage path={c.profile_path} kind="profile" alt={c.name} decorative sizes="6rem" className="mx-auto !size-24 !aspect-square rounded-full transition-transform group-hover:scale-[1.04]" />
                      <span className="mt-2 block line-clamp-1 text-meta font-medium" dir="auto">{c.name}</span>
                      <span className="block line-clamp-1 text-meta text-muted-foreground" dir="auto">{c.character}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {isTv && (
            <section aria-label={t.episodes}>
              <div className="mb-4 flex items-center justify-between gap-4">
                <h3 className="font-display text-title">{t.episodes}</h3>
                <select value={selectedSeason} onChange={(e) => setSelectedSeason(Number(e.target.value))} aria-label={t.seasonSelect} className="h-10 rounded-full bg-muted px-4 text-sm font-medium outline-none focus-visible:outline-2">
                  {seasonNumbers.map((n) => <option key={n} value={n}>{t.seasonSelect} {n}</option>)}
                </select>
              </div>
              {seasonLoading ? (
                <p role="status" className="flex items-center justify-center gap-2 py-8 text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden />{t.episodesLoading}</p>
              ) : season?.episodes?.length ? (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {season.episodes.map((ep) => (
                    <li key={ep.id}>
                      <button type="button" onClick={() => { onPlay(item, selectedSeason, ep.episode_number); onClose(); }} className="group flex w-full items-center gap-3 rounded-[var(--radius-lg)] bg-muted/60 p-2 text-start transition-colors hover:bg-muted focus-visible:outline-2">
                        <TmdbImage path={ep.still_path} kind="still" alt={ep.name} decorative sizes="8rem" className="w-28 shrink-0 rounded-[var(--radius-md)]" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium" dir="auto"><span className="tabular-nums">{ep.episode_number}.</span> {ep.name || `${t.episode} ${ep.episode_number}`}</span>
                          <span className="block text-meta text-muted-foreground tabular-nums">{ep.air_date}{ep.runtime ? ` · ${ep.runtime}${t.minutes}` : ""}</span>
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground rtl:-scale-x-100" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="flex items-center gap-2 text-muted-foreground"><Info className="size-4" aria-hidden />{t.noEpisodes}</p>
              )}
            </section>
          )}

          {recs.length > 0 && (
            <section aria-label={t.recommendations}>
              <h3 className="mb-4 font-display text-title">{t.recommendations}</h3>
              <ul ref={recsRef} onPointerDown={recsScroll.onPointerDown} onPointerMove={recsScroll.onPointerMove} onPointerUp={recsScroll.onPointerUp} onPointerCancel={recsScroll.onPointerCancel} className="drag-scroll -mx-6 flex gap-4 overflow-x-auto px-6 pb-2 scrollbar-none sm:-mx-10 sm:px-10">
                {recs.map((r) => (
                  <li key={r.id} className="w-36 shrink-0">
                    <MediaCard media={r} lang={lang} bilingual={bilingual} onPlay={(m) => { onPlay(m); onClose(); }} onSelectDetails={(m) => useOnyxStore.getState().setDetailsMedia(m)} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
