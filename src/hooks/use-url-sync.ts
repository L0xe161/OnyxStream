"use client";

import { useEffect, useRef } from "react";
import { useOnyxStore } from "@/lib/store";
import { fetchDetails, fetchPerson } from "@/lib/tmdb";
import { decodeUrl, encodeUrl, navigationKey, type UrlSnapshot } from "@/lib/url-state";
import type { TMDBMediaItem } from "@/lib/types";

const typeOf = (m: TMDBMediaItem) => (m.media_type === "tv" || m.first_air_date ? ("tv" as const) : ("movie" as const));

function snapshotFromStore(): UrlSnapshot {
  const s = useOnyxStore.getState();
  return {
    tab: s.currentTab,
    details: s.detailsMedia ? { type: typeOf(s.detailsMedia), id: s.detailsMedia.id } : null,
    play: s.activeMedia
      ? { type: typeOf(s.activeMedia), id: s.activeMedia.id, season: s.activeSeason, episode: s.activeEpisode }
      : null,
    person: s.activePerson?.id ?? null,
    search: s.isSearchOpen ? s.searchQuery : null,
    catalog: s.catalog,
  };
}

/**
 * Keeps the store and the address bar in step so the Back button closes
 * overlays instead of leaving the site, refresh restores the view, and links
 * are shareable. Opening something pushes a history entry; typing or
 * filtering only replaces the current one.
 */
export function useUrlSync() {
  const lastKey = useRef<string | null>(null);
  const pending = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const applyFromUrl = async (isBoot = false) => {
      // A bare URL on first load must not clobber the tab restored from storage.
      if (isBoot && window.location.search === "") {
        lastKey.current = navigationKey(snapshotFromStore());
        return;
      }
      const snap = decodeUrl(window.location.search);
      const store = useOnyxStore.getState();
      const opts = { artworkLang: store.artworkLang, uiLang: store.lang };
      pending.current += 1;
      try {
        store.setCurrentTab(snap.tab);
        store.setCatalog(snap.catalog);
        store.setSearchQuery(snap.search ?? "");
        store.setSearchOpen(snap.search !== null);

        const sameDetails = store.detailsMedia?.id === snap.details?.id;
        const samePlay = store.activeMedia?.id === snap.play?.id;
        const samePerson = store.activePerson?.id === snap.person;

        const [details, play, person] = await Promise.all([
          snap.details && !sameDetails ? fetchDetails(snap.details.id, snap.details.type, opts) : null,
          snap.play && !samePlay ? fetchDetails(snap.play.id, snap.play.type, opts) : null,
          snap.person && !samePerson ? fetchPerson(snap.person, opts) : null,
        ]);
        if (cancelled) return;

        const next = useOnyxStore.getState();
        if (!snap.details) next.setDetailsMedia(null);
        else if (details) next.setDetailsMedia(details);

        if (!snap.play) next.clearActiveStream();
        else if (play) next.setActiveStream(play, snap.play.season, snap.play.episode, snap.play.server);
        else if (samePlay) next.setActiveStream(next.activeMedia as TMDBMediaItem, snap.play.season, snap.play.episode, snap.play.server);

        if (!snap.person) next.setActivePerson(null);
        else if (person) next.setActivePerson(person);

      } finally {
        pending.current -= 1;
      }
      lastKey.current = navigationKey(snapshotFromStore());
    };

    void applyFromUrl(true);
    const onPop = () => void applyFromUrl();
    window.addEventListener("popstate", onPop);

    const unsubscribe = useOnyxStore.subscribe(() => {
      if (pending.current > 0) return;
      const snap = snapshotFromStore();
      const search = encodeUrl(snap);
      if (search === window.location.search) {
        lastKey.current = navigationKey(snap);
        return;
      }
      const key = navigationKey(snap);
      const url = `${window.location.pathname}${search}${window.location.hash}`;
      if (lastKey.current !== null && key !== lastKey.current) window.history.pushState(null, "", url);
      else window.history.replaceState(null, "", url);
      lastKey.current = key;
    });

    return () => {
      cancelled = true;
      window.removeEventListener("popstate", onPop);
      unsubscribe();
    };
  }, []);
}
