"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useOnyxStore } from "@/lib/store";
import { getT } from "@/lib/i18n";
import { buildStreamUrl, getServerById, STREAM_SERVERS } from "@/lib/stream-servers";
import { useShowStructure } from "./use-show-structure";
import type { Language, TMDBMediaItem } from "@/lib/types";
import type { SubtitleChoice } from "@/lib/settings";

/** How long a server may take to load before we call it unresponsive. */
const LOAD_TIMEOUT_MS = 15_000;
/** Watch-time sampling interval for the best-effort progress estimate. */
const TICK_MS = 10_000;
const AUTO_NEXT_THRESHOLD = 0.95;

export type StreamStatus = "loading" | "ready" | "failed";

interface Target {
  season: number;
  episode: number;
}

const isTvItem = (m: TMDBMediaItem) => m.media_type === "tv" || !!m.first_air_date || !!m.number_of_seasons;

/**
 * Everything the player needs besides rendering: real season/episode data,
 * the stream URL, load-failure detection with server fallback, and a
 * best-effort watch-progress estimate (embedded players are cross-origin, so
 * true playback position is not readable).
 */
export function usePlayback(media: TMDBMediaItem, lang: Language) {
  const t = getT(lang);
  const season = useOnyxStore((s) => s.activeSeason);
  const episode = useOnyxStore((s) => s.activeEpisode);
  const serverId = useOnyxStore((s) => s.activeServerId);
  const settings = useOnyxStore((s) => s.settings);
  const setActiveSeason = useOnyxStore((s) => s.setActiveSeason);
  const setActiveEpisode = useOnyxStore((s) => s.setActiveEpisode);
  const setActiveServerId = useOnyxStore((s) => s.setActiveServerId);
  const setActiveStream = useOnyxStore((s) => s.setActiveStream);
  const updateSettings = useOnyxStore((s) => s.updateSettings);
  const upsertContinueWatching = useOnyxStore((s) => s.upsertContinueWatching);
  const setProgress = useOnyxStore((s) => s.setProgress);

  const isTv = isTvItem(media);
  const structure = useShowStructure(isTv ? media.id : undefined, lang);
  const seasons = useMemo(() => structure.data ?? [], [structure.data]);

  const [subtitleLang, setSubtitleLangState] = useState<SubtitleChoice>(settings.subtitleLang);
  const [retryNonce, setRetryNonce] = useState(0);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const progress = useOnyxStore((s) => s.continueWatching.find((c) => c.media.id === media.id)?.progress ?? 0);
  const loadedRef = useRef<string | null>(null);
  const tried = useRef<Set<string>>(new Set());
  const watchedSeconds = useRef(0);
  const baseProgress = useRef(0);

  const episodeCount = seasons.find((s) => s.season_number === season)?.episode_count ?? 0;

  const streamUrl = useMemo(() => {
    const server = getServerById(serverId);
    let subtitleVttUrl: string | undefined;
    if (server.supportsSubtitles && subtitleLang !== "off") {
      const params = new URLSearchParams({
        tmdb_id: String(media.id),
        type: isTv ? "tv" : "movie",
        lang: subtitleLang,
        ...(isTv ? { season: String(season), episode: String(episode) } : {}),
      });
      subtitleVttUrl = `${window.location.origin}/api/subtitles?${params.toString()}`;
    }
    return buildStreamUrl(serverId, {
      tmdbId: media.id,
      type: isTv ? "tv" : "movie",
      season,
      episode,
      subtitleVttUrl,
      subtitleLabel: new Intl.DisplayNames([lang], { type: "language" }).of(subtitleLang === "off" ? "en" : subtitleLang),
    });
  }, [media.id, isTv, season, episode, serverId, subtitleLang, lang]);

  const status: StreamStatus = loadedUrl === streamUrl ? "ready" : failedUrl === streamUrl ? "failed" : "loading";

  // Forget which servers failed once the viewer moves to different content.
  useEffect(() => {
    tried.current = new Set();
  }, [media.id, season, episode]);

  const nextServerId = useCallback((): string | null => {
    const ordered = [...STREAM_SERVERS].sort((a, b) => a.priority - b.priority);
    const candidate = ordered.find((s) => s.id !== serverId && !tried.current.has(s.id));
    return candidate?.id ?? null;
  }, [serverId]);

  const switchServer = useCallback(
    (id: string, announce: boolean) => {
      setActiveServerId(id);
      if (announce) {
        const srv = getServerById(id);
        toast(`${t.switchedServer}: ${lang === "ar" ? srv.nameAr : srv.name}`);
      }
    },
    [lang, setActiveServerId, t.switchedServer]
  );

  // Unresponsive-server detection: no load event within the timeout.
  useEffect(() => {
    const url = streamUrl;
    const timer = window.setTimeout(() => {
      if (loadedRef.current === url) return;
      tried.current.add(serverId);
      const next = nextServerId();
      if (settings.autoFallback && next) switchServer(next, true);
      else setFailedUrl(url);
    }, LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [streamUrl, retryNonce, serverId, settings.autoFallback, nextServerId, switchServer]);

  const onFrameLoad = useCallback(() => {
    loadedRef.current = streamUrl;
    setLoadedUrl(streamUrl);
    setFailedUrl(null);
  }, [streamUrl]);

  const retry = useCallback(() => {
    loadedRef.current = null;
    setFailedUrl(null);
    setLoadedUrl(null);
    setRetryNonce((n) => n + 1);
  }, []);

  const tryNextServer = useCallback(() => {
    tried.current.add(serverId);
    const next = nextServerId() ?? STREAM_SERVERS.find((s) => s.id !== serverId)?.id;
    if (next) switchServer(next, false);
  }, [nextServerId, serverId, switchServer]);

  const setSubtitleLang = useCallback(
    (choice: SubtitleChoice) => {
      setSubtitleLangState(choice);
      if (settings.rememberSubtitle) updateSettings({ subtitleLang: choice });
    },
    [settings.rememberSubtitle, updateSettings]
  );

  // Episode navigation across season boundaries.
  const next = useMemo<Target | null>(() => {
    if (!isTv) return null;
    if (episodeCount === 0) return { season, episode: episode + 1 };
    if (episode < episodeCount) return { season, episode: episode + 1 };
    const following = seasons.find((s) => s.season_number > season);
    return following ? { season: following.season_number, episode: 1 } : null;
  }, [isTv, episodeCount, season, episode, seasons]);

  const previous = useMemo<Target | null>(() => {
    if (!isTv) return null;
    if (episode > 1) return { season, episode: episode - 1 };
    const earlier = [...seasons].reverse().find((s) => s.season_number < season);
    return earlier ? { season: earlier.season_number, episode: earlier.episode_count } : null;
  }, [isTv, season, episode, seasons]);

  const goTo = useCallback(
    (target: Target) => {
      setActiveStream(media, target.season, target.episode);
    },
    [media, setActiveStream]
  );

  const selectSeason = useCallback(
    (n: number) => {
      setActiveSeason(n);
      setActiveEpisode(1);
    },
    [setActiveEpisode, setActiveSeason]
  );

  // Record the title in Continue Watching with the exact spot and server.
  useEffect(() => {
    const saved = useOnyxStore.getState().continueWatching.find((c) => c.media.id === media.id);
    const sameSpot = !!saved && saved.season === season && saved.episode === episode;
    baseProgress.current = sameSpot ? saved.progress : 0;
    watchedSeconds.current = 0;
    upsertContinueWatching({
      media,
      season,
      episode,
      serverId,
      progress: baseProgress.current,
      updatedAt: Date.now(),
    });
  }, [media, season, episode, serverId, upsertContinueWatching]);

  // Best-effort progress: count visible time while a stream is actually loaded.
  const runtimeSeconds = (isTv ? media.episode_run_time?.[0] ?? 42 : media.runtime ?? media.__runtime ?? 105) * 60;
  useEffect(() => {
    if (status !== "ready") return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      watchedSeconds.current += TICK_MS / 1000;
      const value = Math.min(1, baseProgress.current + watchedSeconds.current / runtimeSeconds);
      setProgress(media.id, value);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [status, media.id, runtimeSeconds, setProgress]);

  const nearingEnd = settings.autoPlayNext && !!next && progress >= AUTO_NEXT_THRESHOLD;

  return {
    isTv,
    season,
    episode,
    serverId,
    seasons,
    episodeCount,
    structureLoading: structure.isPending && isTv,
    streamUrl,
    retryNonce,
    status,
    subtitleLang,
    setSubtitleLang,
    onFrameLoad,
    retry,
    tryNextServer,
    changeServer: (id: string) => switchServer(id, false),
    next,
    previous,
    goTo,
    selectSeason,
    selectEpisode: setActiveEpisode,
    progress,
    nearingEnd,
  };
}
