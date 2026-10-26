"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { OverlayClose, Overlay } from "./overlay";
import { usePlayback } from "@/hooks/use-playback";
import { useSeason } from "@/hooks/use-tmdb";
import { isComingSoonMovie } from "@/lib/release-gate";
import { useOnyxStore } from "@/lib/store";
import { dirFor, getT } from "@/lib/i18n";
import type { Language, TMDBMediaItem } from "@/lib/types";

export function UnifiedPlayer({ lang }: { lang: Language }) {
  const active = useOnyxStore((s) => s.activeMedia);
  const clear = useOnyxStore((s) => s.clearActiveStream);
  const t = getT(lang);
  // Keep the last title mounted while the exit animation plays.
  const [held, setHeld] = useState(active);
  if (active && active !== held) setHeld(active);
  const title = held ? held.title || held.name || "" : "";

  return (
    <Overlay
      open={!!active}
      onOpenChange={(open) => !open && clear()}
      title={`${t.nowPlaying}: ${title}`}
      variant="theater"
      dir={dirFor(lang)}
    >
      {held && <Theater key={held.id} media={held} lang={lang} />}
    </Overlay>
  );
}

function Theater({ media, lang }: { media: TMDBMediaItem; lang: Language }) {
  // Movies released less than 90 days ago (or not yet released) show a simple
  // notice instead of the embedded player frame.
  if (isComingSoonMovie(media)) return <ComingSoonStage media={media} lang={lang} />;
  return <StreamTheater media={media} lang={lang} />;
}

/** Shown instead of the embed player while a movie is inside its release window. */
function ComingSoonStage({ media, lang }: { media: TMDBMediaItem; lang: Language }) {
  const t = getT(lang);
  const title = media.title || media.name || "";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PlayerHeader title={title} lang={lang} />

      <div className="grid min-h-0 flex-1 place-items-center">
        <div className="relative aspect-video w-full max-h-full max-w-[calc((100dvh-5rem)*16/9)] bg-black max-md:max-w-none">
          <div className="absolute inset-0 grid place-items-center px-6" role="status">
            <p className="max-w-md text-balance text-center font-display text-lg font-medium text-white/90" dir="auto">
              {t.movieComingSoon}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StreamTheater({ media, lang }: { media: TMDBMediaItem; lang: Language }) {
  const t = getT(lang);
  const p = usePlayback(media, lang);
  const artworkLang = useOnyxStore((s) => s.artworkLang);
  // Fetch the season so we can show the active episode NAME (localized), not
  // just its number, and so the episode selector lists every episode.
  const { season, loading: seasonLoading } = useSeason(p.isTv ? media : null, p.season, lang, artworkLang);

  const title = media.title || media.name || "";
  const episodes = season?.episodes ?? [];
  const activeEpisode = episodes.find((e) => e.episode_number === p.episode);
  const activeEpisodeName = activeEpisode?.name || `${t.episode} ${p.episode}`;
  const seasonNumbers = p.seasons.length > 0 ? p.seasons.map((s) => s.season_number) : [p.season];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PlayerHeader title={title} lang={lang}>
        {p.isTv && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative flex items-center">
              <span className="sr-only">{t.seasonSelect}</span>
              <select
                value={p.season}
                onChange={(e) => p.selectSeason(Number(e.target.value))}
                aria-label={t.seasonSelect}
                className="h-10 max-w-full cursor-pointer appearance-none rounded-full bg-white/10 ps-4 pe-8 text-sm font-medium text-white outline-none transition-colors hover:bg-white/16 focus-visible:outline-2 focus-visible:outline-white [&>option]:bg-neutral-900 [&>option]:text-white"
              >
                {seasonNumbers.map((n) => (
                  <option key={n} value={n}>{`${t.seasonShort}${n}`}</option>
                ))}
              </select>
            </label>
            <label className="relative flex items-center">
              <span className="sr-only">{t.episodeSelect}</span>
              <select
                value={p.episode}
                onChange={(e) => p.selectEpisode(Number(e.target.value))}
                aria-label={t.episodeSelect}
                className="h-10 max-w-full cursor-pointer appearance-none rounded-full bg-white/10 ps-4 pe-8 text-sm font-medium text-white outline-none transition-colors hover:bg-white/16 focus-visible:outline-2 focus-visible:outline-white [&>option]:bg-neutral-900 [&>option]:text-white"
              >
                {seasonLoading && <option value={p.episode}>{`${t.episodeShort}${p.episode}`}</option>}
                {!seasonLoading && episodes.length === 0 && (
                  <option value={p.episode}>{`${t.episodeShort}${p.episode}`}</option>
                )}
                {episodes.map((e) => (
                  <option key={e.id} value={e.episode_number}>
                    {`${t.episodeShort}${e.episode_number}. ${e.name || `${t.episode} ${e.episode_number}`}`}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </PlayerHeader>

      {/* Active spot line: shows the current season + localized episode name. */}
      {p.isTv && (
        <p className="shrink-0 px-3 pb-1 text-xs text-white/70 tabular-nums sm:px-5" dir="auto">
          {t.seasonShort}{p.season} · {activeEpisodeName}
        </p>
      )}

      <div className="grid min-h-0 flex-1 place-items-center">
        <div className="relative aspect-video w-full max-h-full max-w-[calc((100dvh-8.5rem)*16/9)] bg-black max-md:max-w-none">
          <iframe
            key={p.retryNonce}
            src={p.streamUrl}
            title={`${title} — ${t.nowPlaying}`}
            onLoad={p.onFrameLoad}
            // Strict sandbox: the embed provider may run its own player scripts
            // and access its own cookies/storage, but cannot navigate the top
            // window, open popups, run modals or reach our origin. Resizing
            // and fullscreen are handled exclusively by the embed's built-in
            // control bar, so we do not add our own.
            sandbox="allow-scripts allow-same-origin allow-presentation allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
            allow="autoplay *; fullscreen *; picture-in-picture *; encrypted-media *"
            allowFullScreen
            referrerPolicy="origin"
            className={`size-full border-0 transition-opacity duration-300 ${p.status === "ready" ? "opacity-100" : "opacity-0"}`}
          />

          {p.status === "loading" && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center" role="status">
              <div className="flex flex-col items-center gap-3 text-sm text-white/80">
                <Loader2 className="size-7 animate-spin" aria-hidden />
                {t.loadingStream}
              </div>
            </div>
          )}

          {p.status === "failed" && (
            <div className="absolute inset-0 grid place-items-center bg-black p-6 text-center" role="alert">
              <div className="flex max-w-sm flex-col items-center gap-4">
                <AlertTriangle className="size-8 text-white/80" aria-hidden />
                <div>
                  <p className="text-lg font-semibold tracking-tight">{t.serverNotResponding}</p>
                  <p className="mt-1 text-sm text-white/70">{t.serverNotRespondingSub}</p>
                </div>
                <button
                  onClick={p.retry}
                  className="h-11 rounded-full bg-white px-5 text-sm font-semibold text-black transition-colors hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  {t.retryServer}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Minimal header: exit button, title, and (for TV) the season/episode selectors. */
function PlayerHeader({ title, lang, children }: { title: string; lang: Language; children?: React.ReactNode }) {
  const t = getT(lang);
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 sm:px-5" aria-label={t.playerControls}>
      <OverlayClose className="grid size-10 shrink-0 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/12 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" aria-label={t.closePlayer}>
        <X className="size-5" aria-hidden />
      </OverlayClose>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-base font-semibold leading-tight tracking-tight" dir="auto">
          {title}
        </h2>
      </div>
      {children}
    </header>
  );
}
