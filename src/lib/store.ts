"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  Language,
  ArtworkLanguage,
  CategoryTab,
  TMDBMediaItem,
  ContinueWatchingItem,
  TMDBPerson,
} from "./types";
import type { ThemeMode, AccentColor } from "./themes";
import { ACCENTS } from "./themes";
import { DEFAULT_CATALOG, type CatalogState } from "./url-state";
import { STORE_KEY } from "./storage-keys";
import { DEFAULT_HOME_ROWS, DEFAULT_SETTINGS, DEFAULT_TABS, reconcileList, type Settings } from "./settings";

/** Bump when the persisted shape changes and extend `migrate` below. */
export const STORE_VERSION = 4;
const MAX_CONTINUE = 20;

export interface OnyxState {
  // Localization & bilingual
  lang: Language;
  artworkLang: ArtworkLanguage;
  bilingual: boolean;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  setArtworkLang: (lang: ArtworkLanguage) => void;
  toggleArtworkLang: () => void;
  setBilingual: (b: boolean) => void;
  toggleBilingual: () => void;

  // Theming
  theme: ThemeMode;
  accent: AccentColor;
  setTheme: (t: ThemeMode) => void;
  cycleTheme: () => void;
  setAccent: (a: AccentColor) => void;

  // Preferences
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  resetSettings: () => void;

  // Navigation
  currentTab: CategoryTab;
  selectedGenreId: number | null;
  setCurrentTab: (tab: CategoryTab) => void;
  setSelectedGenreId: (id: number | null) => void;

  // Watchlist
  watchlist: TMDBMediaItem[];
  toggleWatchlist: (media: TMDBMediaItem) => void;
  setWatchlisted: (media: TMDBMediaItem, on: boolean) => void;
  isWatchlisted: (id: number) => boolean;
  clearWatchlist: () => void;

  // Favorites
  favorites: TMDBMediaItem[];
  toggleFavorite: (media: TMDBMediaItem) => void;
  setFavorite: (media: TMDBMediaItem, on: boolean) => void;
  isFavorite: (id: number) => boolean;
  clearFavorites: () => void;
  importData: (data: Partial<PersistedState>) => void;
  resetAll: () => void;

  // Continue watching
  continueWatching: ContinueWatchingItem[];
  upsertContinueWatching: (item: ContinueWatchingItem) => void;
  removeContinueWatching: (id: number) => void;
  setProgress: (id: number, progress: number) => void;
  restoreContinueWatching: (item: ContinueWatchingItem) => void;
  clearContinueWatching: () => void;

  // Active player
  activeMedia: TMDBMediaItem | null;
  activeSeason: number;
  activeEpisode: number;
  activeServerId: string;
  setActiveStream: (
    media: TMDBMediaItem,
    season?: number,
    episode?: number,
    serverId?: string
  ) => void;
  clearActiveStream: () => void;
  setActiveSeason: (s: number) => void;
  setActiveEpisode: (e: number) => void;
  setActiveServerId: (id: string) => void;

  // Catalog filters (kept here so they can live in the URL)
  catalog: CatalogState;
  setCatalog: (patch: Partial<CatalogState>) => void;
  resetCatalog: () => void;

  // Details modal
  detailsMedia: TMDBMediaItem | null;
  setDetailsMedia: (m: TMDBMediaItem | null) => void;

  // Person modal
  activePerson: TMDBPerson | null;
  setActivePerson: (p: TMDBPerson | null) => void;

  // Global panels
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  shortcutsOpen: boolean;
  setShortcutsOpen: (open: boolean) => void;

  // Search overlay
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  isSearchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  toggleSearch: () => void;
}


type PersistedState = Pick<
  OnyxState,
  | "lang" | "artworkLang" | "bilingual" | "theme" | "accent" | "currentTab"
  | "watchlist" | "favorites" | "continueWatching" | "activeServerId" | "settings"
>;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/**
 * Turns anything found in storage or an imported file into a valid persisted
 * state. Handles every historical shape (v0-v3 had no `settings`, and
 * continue-watching held one entry per episode) so nobody loses data.
 */
export function sanitizePersisted(raw: Partial<PersistedState> | undefined, base: OnyxState | null): Partial<PersistedState> {
  if (!isRecord(raw)) return {};
  const out: Partial<PersistedState> = {};

  if (raw.lang === "en" || raw.lang === "ar") out.lang = raw.lang;
  // Artwork language is no longer a separate preference: covers always follow
  // the interface language (Arabic UI -> Arabic posters, English UI -> English posters).
  out.artworkLang = out.lang ?? "en";
  if (typeof raw.bilingual === "boolean") out.bilingual = raw.bilingual;
  if (raw.theme === "dark" || raw.theme === "light" || raw.theme === "frosted") out.theme = raw.theme;
  // Accent: validate against the known palette so an unknown/old value falls
  // back to white rather than crashing the theme applier. The picker is back
  // in the settings sheet, so the user's choice is honoured again.
  out.accent = typeof raw.accent === "string" && ACCENTS.some((a) => a.id === raw.accent)
    ? (raw.accent as AccentColor)
    : "white";
  if (typeof raw.currentTab === "string") out.currentTab = raw.currentTab as CategoryTab;
  if (typeof raw.activeServerId === "string") out.activeServerId = raw.activeServerId;

  const media = (v: unknown) => asArray<TMDBMediaItem>(v).filter((m) => isRecord(m) && typeof m.id === "number");
  if ("watchlist" in raw) out.watchlist = media(raw.watchlist);
  if ("favorites" in raw) out.favorites = media(raw.favorites);

  if ("continueWatching" in raw) {
    const seen = new Set<number>();
    out.continueWatching = asArray<ContinueWatchingItem>(raw.continueWatching)
      .filter((c) => isRecord(c) && isRecord(c.media) && typeof c.media.id === "number")
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
      .filter((c) => (seen.has(c.media.id) ? false : (seen.add(c.media.id), true)))
      .map((c) => ({
        ...c,
        season: c.season || 1,
        episode: c.episode || 1,
        progress: Math.min(1, Math.max(0, Number(c.progress) || 0)),
        updatedAt: c.updatedAt || Date.now(),
      }))
      .slice(0, MAX_CONTINUE);
  }

  const stored = isRecord(raw.settings) ? (raw.settings as Partial<Settings>) : {};
  const previous = base?.settings ?? DEFAULT_SETTINGS;
  out.settings = {
    ...previous,
    ...stored,
    homeRows: reconcileList(stored.homeRows, DEFAULT_HOME_ROWS),
    tabs: reconcileList(stored.tabs, DEFAULT_TABS),
  };
  return out;
}

export const useOnyxStore = create<OnyxState>()(
  persist(
    (set, get) => ({
      lang: "en",
      artworkLang: "en",
      bilingual: false,
      setLang: (lang) => set({ lang, artworkLang: lang }),
      toggleLang: () =>
        set((s) => ({ lang: s.lang === "en" ? "ar" : "en", artworkLang: s.lang === "en" ? "ar" : "en" })),
      setArtworkLang: (artworkLang) => set({ artworkLang }),
      toggleArtworkLang: () =>
        set((s) => ({ artworkLang: s.artworkLang === "en" ? "ar" : "en" })),
      setBilingual: (bilingual) => set({ bilingual }),
      toggleBilingual: () => set((s) => ({ bilingual: !s.bilingual })),

      theme: "dark",
      accent: "white",
      setTheme: (theme) => set({ theme }),
      cycleTheme: () =>
        set((s) => ({
          theme:
            s.theme === "dark" ? "light" : s.theme === "light" ? "frosted" : "dark",
        })),
      setAccent: (accent) => set({ accent }),

      settings: DEFAULT_SETTINGS,
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      resetSettings: () => set({ settings: DEFAULT_SETTINGS, theme: "dark", accent: "white" }),

      currentTab: "all",
      selectedGenreId: null,
      setCurrentTab: (currentTab) => set({ currentTab }),
      setSelectedGenreId: (selectedGenreId) => set({ selectedGenreId }),

      watchlist: [],
      toggleWatchlist: (media) =>
        set((s) => {
          const exists = s.watchlist.some((w) => w.id === media.id);
          return {
            watchlist: exists
              ? s.watchlist.filter((w) => w.id !== media.id)
              : [media, ...s.watchlist],
          };
        }),
      setWatchlisted: (media, on) =>
        set((s) => {
          const without = s.watchlist.filter((w) => w.id !== media.id);
          return { watchlist: on ? [media, ...without] : without };
        }),
      isWatchlisted: (id) => get().watchlist.some((w) => w.id === id),
      clearWatchlist: () => set({ watchlist: [] }),

      favorites: [],
      toggleFavorite: (media) =>
        set((s) => {
          const exists = s.favorites.some((f) => f.id === media.id);
          return {
            favorites: exists
              ? s.favorites.filter((f) => f.id !== media.id)
              : [media, ...s.favorites],
          };
        }),
      setFavorite: (media, on) =>
        set((s) => {
          const without = s.favorites.filter((f) => f.id !== media.id);
          return { favorites: on ? [media, ...without] : without };
        }),
      isFavorite: (id) => get().favorites.some((f) => f.id === id),
      clearFavorites: () => set({ favorites: [] }),
      importData: (data) => set((s) => ({ ...s, ...sanitizePersisted(data, s) })),
      resetAll: () =>
        set({
          settings: DEFAULT_SETTINGS,
          theme: "dark",
          accent: "white",
          lang: "en",
          artworkLang: "en",
          bilingual: false,
          watchlist: [],
          favorites: [],
          continueWatching: [],
        }),

      continueWatching: [],
      upsertContinueWatching: (item) =>
        set((s) => {
          const previous = s.continueWatching.find((c) => c.media.id === item.media.id);
          const sameSpot = previous && previous.season === item.season && previous.episode === item.episode;
          const entry: ContinueWatchingItem = {
            ...item,
            progress: sameSpot ? Math.max(previous.progress, item.progress) : item.progress,
            updatedAt: Date.now(),
          };
          const rest = s.continueWatching.filter((c) => c.media.id !== item.media.id);
          return { continueWatching: [entry, ...rest].slice(0, MAX_CONTINUE) };
        }),
      setProgress: (id, progress) =>
        set((s) => ({
          continueWatching: s.continueWatching.map((c) =>
            c.media.id === id ? { ...c, progress: Math.min(1, Math.max(0, progress)), updatedAt: Date.now() } : c
          ),
        })),
      restoreContinueWatching: (item) =>
        set((s) => ({
          continueWatching: [item, ...s.continueWatching.filter((c) => c.media.id !== item.media.id)]
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .slice(0, MAX_CONTINUE),
        })),
      removeContinueWatching: (id) =>
        set((s) => ({
          continueWatching: s.continueWatching.filter((c) => c.media.id !== id),
        })),
      clearContinueWatching: () => set({ continueWatching: [] }),

      activeMedia: null,
      activeSeason: 1,
      activeEpisode: 1,
      activeServerId: "embedmaster",
      setActiveStream: (media, season = 1, episode = 1, serverId) =>
        set({
          activeMedia: media,
          activeSeason: season,
          activeEpisode: episode,
          activeServerId: serverId ?? get().activeServerId,
        }),
      clearActiveStream: () => set({ activeMedia: null }),
      setActiveSeason: (activeSeason) => set({ activeSeason }),
      setActiveEpisode: (activeEpisode) => set({ activeEpisode }),
      setActiveServerId: (activeServerId) => set({ activeServerId }),

      detailsMedia: null,
      setDetailsMedia: (detailsMedia) => set({ detailsMedia }),

      activePerson: null,
      setActivePerson: (activePerson) => set({ activePerson }),

      settingsOpen: false,
      setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
      paletteOpen: false,
      setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
      shortcutsOpen: false,
      setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),

      searchQuery: "",
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      catalog: DEFAULT_CATALOG,
      setCatalog: (patch) => set((s) => ({ catalog: { ...s.catalog, ...patch } })),
      resetCatalog: () => set({ catalog: DEFAULT_CATALOG }),

      isSearchOpen: false,
      setSearchOpen: (isSearchOpen) => set({ isSearchOpen }),
      toggleSearch: () => set((s) => ({ isSearchOpen: !s.isSearchOpen })),
    }),
    {
      name: STORE_KEY,
      version: STORE_VERSION,
      migrate: (persisted) => sanitizePersisted(persisted as Partial<PersistedState>, null),
      merge: (persisted, current) => ({
        ...current,
        ...sanitizePersisted(persisted as Partial<PersistedState>, current),
      }),
      storage: createJSONStorage(() => {
        if (typeof window === "undefined") {
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }
        return window.localStorage;
      }),
      partialize: (s) => ({
        lang: s.lang,
        artworkLang: s.artworkLang,
        bilingual: s.bilingual,
        theme: s.theme,
        accent: s.accent,
        currentTab: s.currentTab,
        watchlist: s.watchlist,
        favorites: s.favorites,
        continueWatching: s.continueWatching,
        activeServerId: s.activeServerId,
        settings: s.settings,
      }),
    }
  )
);

export function useIsWatchlisted(id: number | undefined): boolean {
  return useOnyxStore((s) => (id ? s.watchlist.some((w) => w.id === id) : false));
}

export function useIsFavorite(id: number | undefined): boolean {
  return useOnyxStore((s) => (id ? s.favorites.some((f) => f.id === id) : false));
}
