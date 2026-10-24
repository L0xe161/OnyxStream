"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, Maximize2, Minimize2, Server, SkipForward, Subtitles, X } from "lucide-react";
import { OverlayClose, Overlay } from "./overlay";
import { usePlayback } from "@/hooks/use-playback";
import { STREAM_SERVERS } from "@/lib/stream-servers";
import { isComingSoonMovie } from "@/lib/release-gate";
import { useOnyxStore } from "@/lib/store";
import { dirFor, getT } from "@/lib/i18n";
import type { Language, TMDBMediaItem } from "@/lib/types";
import type { SubtitleChoice } from "@/lib/settings";

const SUBTITLE_CHOICES: readonly SubtitleChoice[] = ["off", "ar", "en", "fr", "es", "de", "tr"];
const AUTO_NEXT_SECONDS = 10;

const iconButton =
  "grid size-10 shrink-0 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/12 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:pointer-events-none disabled:opacity-30";
const selectClass =
  "h-10 max-w-full cursor-pointer appearance-none rounded-full bg-white/10 ps-4 pe-4 text-sm font-medium text-white outline-none transition-colors hover:bg-white/16 focus-visible:outline-2 focus-visible:outline-white [&>option]:bg-neutral-900 [&>option]:text-white";

function LabeledSelect({ label, icon, children }: { label: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <label className="relative flex items-center">
      <span className="sr-only">{label}</span>
      {icon && <span className="pointer-events-none absolute start-3 text-white/70">{icon}</span>}
      {children}
    </label>
  );
}

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
  // notice instead of the embedded player frame. The check is derived from the
  // clock on every mount, so it lifts itself automatically once 90 days have
  // passed — no stored flag, no manual intervention.
  if (isComingSoonMovie(media)) return <ComingSoonStage media={media} lang={lang} />;
  return <StreamTheater media={media} lang={lang} />;
}

/** Shown instead of the embed player while a movie is inside its release window. */
function ComingSoonStage({ media, lang }: { media: TMDBMediaItem; lang: Language }) {
  const t = getT(lang);
  const title = media.title || media.name || "";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 sm:px-5" aria-label={t.playerControls}>
        <OverlayClose className={iconButton} aria-label={t.closePlayer}>
          <X className="size-5" aria-hidden />
        </OverlayClose>

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold leading-tight tracking-tight" dir="auto">
            {title}
          </h2>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 place-items-center">
        <div className="relative aspect-video w-full max-h-full max-w-[calc((100dvh-8.5rem)*16/9)] bg-black max-md:max-w-none">
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
  const autoPlayNext = useOnyxStore((s) => s.settings.autoPlayNext);
  const updateSettings = useOnyxStore((s) => s.updateSettings);
  const frameRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setFullscreen] = useState(false);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);

  const title = media.title || media.name || "";
  const spot = `${p.season}-${p.episode}`;
  const showUpNext = p.nearingEnd && dismissedFor !== spot && !!p.next;

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === frameRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void frameRef.current?.requestFullscreen?.();
  }, []);

  const episodeNumbers = p.episodeCount > 0 ? Array.from({ length: p.episodeCount }, (_, i) => i + 1) : [p.episode];
  const seasonNumbers = p.seasons.length > 0 ? p.seasons.map((s) => s.season_number) : [p.season];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 sm:px-5" aria-label={t.playerControls}>
        <OverlayClose className={iconButton} aria-label={t.closePlayer}>
          <X className="size-5" aria-hidden />
        </OverlayClose>

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold leading-tight tracking-tight" dir="auto">
            {title}
          </h2>
          {p.isTv && (
            <p className="text-xs text-white/70 tabular-nums">
              {t.seasonSelect} {p.season} · {t.episodeSelect} {p.episode}
            </p>
          )}
        </div>

        {p.isTv && (
          <div className="flex items-center gap-1">
            <button className={iconButton} disabled={!p.previous} onClick={() => p.previous && p.goTo(p.previous)} aria-label={t.prevEpisode} title={t.prevEpisode}>
              <ChevronLeft className="size-5 rtl:-scale-x-100" aria-hidden />
            </button>
            <LabeledSelect label={t.seasonSelect}>
              <select className={selectClass} value={p.season} onChange={(e) => p.selectSeason(Number(e.target.value))}>
                {seasonNumbers.map((n) => (
                  <option key={n} value={n}>{`${t.seasonShort}${n}`}</option>
                ))}
              </select>
            </LabeledSelect>
            <LabeledSelect label={t.episodeSelect}>
              <select className={selectClass} value={p.episode} onChange={(e) => p.selectEpisode(Number(e.target.value))}>
                {episodeNumbers.map((n) => (
                  <option key={n} value={n}>{`${t.episodeShort}${n}`}</option>
                ))}
              </select>
            </LabeledSelect>
            <button className={iconButton} disabled={!p.next} onClick={() => p.next && p.goTo(p.next)} aria-label={t.nextEpisode} title={t.nextEpisode}>
              <ChevronRight className="size-5 rtl:-scale-x-100" aria-hidden />
            </button>
          </div>
        )}

        <button className={iconButton} onClick={toggleFullscreen} aria-label={isFullscreen ? t.exitFullscreen : t.fullscreen} title={isFullscreen ? t.exitFullscreen : t.fullscreen}>
          {isFullscreen ? <Minimize2 className="size-5" aria-hidden /> : <Maximize2 className="size-5" aria-hidden />}
        </button>
      </header>

      <div
        className="h-0.5 shrink-0 bg-white/10"
        role="progressbar"
        aria-label={t.watchedPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(p.progress * 100)}
      >
        <div className="h-full origin-left bg-[var(--primary)] transition-[width] duration-500 rtl:origin-right" style={{ width: `${p.progress * 100}%` }} />
      </div>

      <div className="grid min-h-0 flex-1 place-items-center">
        <div ref={frameRef} className="relative aspect-video w-full max-h-full max-w-[calc((100dvh-8.5rem)*16/9)] bg-black max-md:max-w-none">
          <iframe
            key={p.retryNonce}
            src={p.streamUrl}
            title={`${title} — ${t.nowPlaying}`}
            onLoad={p.onFrameLoad}
            // Strict sandbox: the embed provider may run its own player scripts
            // and access its own cookies/storage, but cannot navigate the top
            // window, open popups, run modals or reach our origin. Combined
            // with `referrerPolicy="origin"` we leak nothing but our scheme+host.
            sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
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
                <div className="flex flex-wrap justify-center gap-2">
                  <button onClick={p.tryNextServer} className="h-11 rounded-full bg-white px-5 text-sm font-semibold text-black transition-colors hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                    {t.tryNextServer}
                  </button>
                  <button onClick={p.retry} className="h-11 rounded-full bg-white/12 px-5 text-sm font-semibold transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                    {t.retryServer}
                  </button>
                </div>
              </div>
            </div>
          )}

          {showUpNext && p.next && (
            <UpNext
              key={`${p.next.season}-${p.next.episode}`}
              label={`${t.upNext}: ${t.seasonShort}${p.next.season} ${t.episodeShort}${p.next.episode}`}
              countdownLabel={t.playingNextIn}
              cancelLabel={t.cancel}
              playLabel={t.nextEpisode}
              onPlay={() => p.next && p.goTo(p.next)}
              onCancel={() => setDismissedFor(spot)}
            />
          )}
        </div>
      </div>

      <footer className="flex shrink-0 flex-wrap items-center gap-2 px-3 py-3 sm:px-5">
        <LabeledSelect label={t.serverSelect} icon={<Server className="size-4" aria-hidden />}>
          <select className={`${selectClass} ps-10`} value={p.serverId} onChange={(e) => p.changeServer(e.target.value)}>
            {STREAM_SERVERS.map((s) => (
              <option key={s.id} value={s.id}>{lang === "ar" ? s.nameAr : s.name}</option>
            ))}
          </select>
        </LabeledSelect>

        <LabeledSelect label={t.selectSubtitle} icon={<Subtitles className="size-4" aria-hidden />}>
          <select className={`${selectClass} ps-10`} value={p.subtitleLang} onChange={(e) => p.setSubtitleLang(e.target.value as SubtitleChoice)}>
            {SUBTITLE_CHOICES.map((code) => (
              <option key={code} value={code}>
                {code === "off" ? t.subtitlesOff : new Intl.DisplayNames([lang], { type: "language" }).of(code)}
              </option>
            ))}
          </select>
        </LabeledSelect>

        {p.isTv && (
          <label className="ms-auto flex cursor-pointer items-center gap-2 text-sm text-white/80">
            <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={autoPlayNext} onChange={(e) => updateSettings({ autoPlayNext: e.target.checked })} />
            {t.autoNextEpisode}
          </label>
        )}
      </footer>
    </div>
  );
}

function UpNext({
  label, countdownLabel, cancelLabel, playLabel, onPlay, onCancel,
}: {
  label: string; countdownLabel: string; cancelLabel: string; playLabel: string; onPlay: () => void; onCancel: () => void;
}) {
  const [left, setLeft] = useState(AUTO_NEXT_SECONDS);

  useEffect(() => {
    const id = window.setInterval(() => setLeft((s) => s - 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (left <= 0) onPlay();
  }, [left, onPlay]);

  return (
    <div className="absolute bottom-4 end-4 flex max-w-[calc(100%-2rem)] items-center gap-3 rounded-2xl bg-black/85 p-3 text-white" role="status">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{label}</p>
        <p className="text-xs tabular-nums text-white/70">{countdownLabel} {Math.max(left, 0)}</p>
      </div>
      <button onClick={onPlay} className="grid size-10 place-items-center rounded-full bg-white text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" aria-label={playLabel}>
        <SkipForward className="size-4 rtl:-scale-x-100" aria-hidden />
      </button>
      <button onClick={onCancel} className="h-10 rounded-full bg-white/12 px-4 text-sm font-medium hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white">
        {cancelLabel}
      </button>
    </div>
  );
}
