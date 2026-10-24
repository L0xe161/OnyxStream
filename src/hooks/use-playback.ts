"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOnyxStore } from "@/lib/store";
import { buildStreamUrl } from "@/lib/stream-servers";
import { useShowStructure } from "./use-show-structure";
import type { Language, TMDBMediaItem } from "@/lib/types";

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
 * Everything the player needs besides rendering: real season/episode data
 * (from TMDB), the single EmbedMaster stream URL, a reload-on-failure retry,
 * and a best-effort watch-progress estimate (embedded players are cross-origin,
 * so true playback position is not readable).
 *
 * Server fallback and subtitle logic have been removed: there is exactly one
 * server, and the embed's own controls handle captions.
 */
export function usePlayback(media: TMDBMediaItem, lang: Language) {
  const season = useOnyxStore((s) => s.activeSeason);
  const episode = useOnyxStore((s) => s.activeEpisode);
  const setActiveSeason = useOnyxStore((s) => s.setActiveSeason);
  const setActiveEpisode = useOnyxStore((s) => s.setActiveEpisode);
  const setActiveStream = useOnyxStore((s) => s.setActiveStream);
  const settings = useOnyxStore((s) => s.settings);
  const upsertContinueWatching = useOnyxStore((s) => s.upsertContinueWatching);
  const setProgress = useOnyxStore((s) => s.setProgress);

  const isTv = isTvItem(media);
  const structure = useShowStructure(isTv ? media.id : undefined, lang);
  const seasons = useMemo(() => structure.data ?? [], [structure.data]);

  const [retryNonce, setRetryNonce] = useState(0);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const progress = useOnyxStore((s) => s.continueWatching.find((c) => c.media.id === media.id)?.progress ?? 0);
  const loadedRef = useRef<string | null>(null);
  const baseProgress = useRef(0);

  const episodeCount = seasons.find((s) => s.season_number === season)?.episode_count ?? 0;

  const streamUrl = useMemo(
    () => buildStreamUrl("embedmaster", {
      tmdbId: media.id,
      type: isTv ? "tv" : "movie",
      season,
      episode,
    }),
    [media.id, isTv, season, episode]
  );

  const status: StreamStatus = loadedUrl === streamUrl ? "ready" : failedUrl === streamUrl ? "failed" : "loading";

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

  // Record the title in Continue Watching with the exact spot.
  useEffect(() => {
    const saved = useOnyxStore.getState().continueWatching.find((c) => c.media.id === media.id);
    const sameSpot = !!saved && saved.season === season && saved.episode === episode;
    baseProgress.current = sameSpot ? saved.progress : 0;
    upsertContinueWatching({
      media,
      season,
      episode,
      serverId: "embedmaster",
      progress: baseProgress.current,
      updatedAt: Date.now(),
    });
  }, [media, season, episode, upsertContinueWatching]);

  // Best-effort progress: count visible time while a stream is actually loaded.
  const runtimeSeconds = (isTv ? media.episode_run_time?.[0] ?? 42 : media.runtime ?? media.__runtime ?? 105) * 60;
  useEffect(() => {
    if (status !== "ready") return;
    const startedAt = Date.now();
    const tick = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const value = Math.min(1, baseProgress.current + (Date.now() - startedAt) / 1000 / runtimeSeconds);
      setProgress(media.id, value);
    }, TICK_MS);
    return () => window.clearInterval(tick);
  }, [status, media.id, runtimeSeconds, setProgress]);

  const nearingEnd = settings.autoPlayNext && !!next && progress >= AUTO_NEXT_THRESHOLD;

  return {
    isTv,
    season,
    episode,
    serverId: "embedmaster",
    seasons,
    episodeCount,
    structureLoading: structure.isPending && isTv,
    streamUrl,
    retryNonce,
    status,
    onFrameLoad,
    retry,
    next,
    previous,
    goTo,
    selectSeason,
    selectEpisode: setActiveEpisode,
    progress,
    nearingEnd,
  };
}
