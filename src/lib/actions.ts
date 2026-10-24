"use client";

import { toast } from "sonner";
import { useOnyxStore } from "./store";
import { getT } from "./i18n";
import type { TMDBMediaItem } from "./types";

const titleOf = (m: TMDBMediaItem) => m.title || m.name || "";

/** Adds or removes a favourite with the same toast + Undo everywhere. */
export function toggleFavoriteWithUndo(media: TMDBMediaItem): void {
  const state = useOnyxStore.getState();
  const t = getT(state.lang);
  const wasOn = state.favorites.some((f) => f.id === media.id);
  state.setFavorite(media, !wasOn);
  toast(wasOn ? t.removedFromFavorites : t.addedToFavorites, {
    description: titleOf(media),
    action: { label: t.undo, onClick: () => useOnyxStore.getState().setFavorite(media, wasOn) },
  });
}

/** Removes a Continue Watching entry, restorable from the toast. */
export function removeContinueWithUndo(id: number): void {
  const state = useOnyxStore.getState();
  const t = getT(state.lang);
  const entry = state.continueWatching.find((c) => c.media.id === id);
  if (!entry) return;
  state.removeContinueWatching(id);
  toast(t.removedFromContinue, {
    description: titleOf(entry.media),
    action: { label: t.undo, onClick: () => useOnyxStore.getState().restoreContinueWatching(entry) },
  });
}

/**
 * Opens the player. When the user has previous progress for this title and did
 * not ask for a specific episode, honours their "resume" preference.
 */
export function startPlayback(media: TMDBMediaItem, season?: number, episode?: number, serverId?: string): void {
  const state = useOnyxStore.getState();
  const t = getT(state.lang);
  const previous = state.continueWatching.find((c) => c.media.id === media.id);
  const explicit = season !== undefined || episode !== undefined;
  const isTv = media.media_type === "tv" || !!media.first_air_date;

  if (previous && !explicit && state.settings.resume !== "never") {
    const where = isTv ? ` S${previous.season} · E${previous.episode}` : "";
    if (state.settings.resume === "always" || !isTv) {
      state.setActiveStream(media, previous.season, previous.episode, serverId ?? previous.serverId);
    } else {
      state.setActiveStream(media, 1, 1, serverId);
      toast(`${t.resumeAt}${where}?`, {
        action: {
          label: t.resumeAt,
          onClick: () => useOnyxStore.getState().setActiveStream(media, previous.season, previous.episode, previous.serverId),
        },
      });
    }
  } else {
    state.setActiveStream(media, season ?? 1, episode ?? 1, serverId);
  }
  state.setDetailsMedia(null);
  state.setSearchOpen(false);
}

/** Clears the whole watch history; the toast offers to bring it back. */
export function clearContinueWithUndo(): void {
  const state = useOnyxStore.getState();
  const t = getT(state.lang);
  const snapshot = state.continueWatching;
  if (snapshot.length === 0) return;
  state.clearContinueWatching();
  toast(t.cleared, {
    action: {
      label: t.undo,
      onClick: () => snapshot.slice().reverse().forEach((item) => useOnyxStore.getState().restoreContinueWatching(item)),
    },
  });
}
