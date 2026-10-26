"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  Language,
  ArtworkLanguage,
  CategoryTab,
  MediaType,
  TMDBMediaItem,
  ContinueWatchingItem,
  TMDBPerson,
} from "./types";
import type { ThemeMode, AccentColor } from "./themes";
import { ACCENTS } from "./themes";
import { DEFAULT_CATALOG, type CatalogState } from "./url-state";
import { STORE_KEY } from "./storage-keys";
import { DEFAULT_HOME_ROWS, DEFAULT_SETTINGS, DEFAULT_TABS, reconcileList, type Settings } from "./settings";
import { fetchItem } from "./tmdb";

/** Bump when the persisted shape changes and extend `migrate` below. */
export const STORE_VERSION = 7;
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

  /** Re-fetch localized title/overview/artwork for every stored list snapshot
   *  (favorites + continue-watching) so they follow the active interface
   *  language. Fire-and-forget; only commits if the language hasn't changed
   *  again while the fetches were in flight. */
  refreshLocalizedLists: (lang: Language, artworkLang: ArtworkLanguage) => void;

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
  | "favorites" | "continueWatching" | "activeServerId" | "settings"
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

  if (raw.lang === "en" || raw.lang === "ar" || raw.lang === "fa") out.lang = raw.lang;
  // Artwork language is no longer a separate preference: covers always follow
  // the interface language (Arabic UI -> Arabic posters, English UI -> English posters).
  out.artworkLang = out.lang ?? "en";
  if (typeof raw.bilingual === "boolean") out.bilingual = raw.bilingual;
  // Only the dark theme is available now; force everyone to dark regardless
  // of what they had persisted (light/frosted have been removed).
  out.theme = "dark";
  // Accent: validate against the known palette so an unknown/old value falls
  // back to white rather than crashing the theme applier. The picker is back
  // in the settings sheet, so the user's choice is honoured again.
  out.accent = typeof raw.accent === "string" && ACCENTS.some((a) => a.id === raw.accent)
    ? (raw.accent as AccentColor)
    : "white";
  if (typeof raw.currentTab === "string") {
    // The "watchlist" tab was removed; send anyone who had it selected to Home.
    out.currentTab = ((raw.currentTab as string) === "watchlist" ? "all" : raw.currentTab) as CategoryTab;
  }
  if (typeof raw.activeServerId === "string") out.activeServerId = raw.activeServerId;

  const media = (v: unknown) => asArray<TMDBMediaItem>(v).filter((m) => isRecord(m) && typeof m.id === "number");
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
    // "Hide completed items" is force-enabled in the background and its toggle
    // was removed from the Settings UI — ensure it is always on regardless of
    // what was persisted before, so finished titles never resurface.
    hideWatched: true,
  };
  return out;
}

export const useOnyxStore = create<OnyxState>()(
  persist(
    (set, get) => ({
      lang: "en",
      artworkLang: "en",
      bilingual: false,
      setLang: (lang) => {
        set({ lang, artworkLang: lang });
        // Stored list snapshots (favorites, continue-watching) hold the
        // title/overview/artwork from the OLD language; refresh them so the
        // whole UI — not just the live catalog rows — follows the switch.
        void get().refreshLocalizedLists(lang, lang);
      },
      toggleLang: () => {
        // Cycle EN → AR → FA → EN so a single toggle button walks all three
        // languages; the button's label (`t.langToggle`) shows the next one.
        const next = get().lang === "en" ? "ar" : get().lang === "ar" ? "fa" : "en";
        set({ lang: next, artworkLang: next });
        void get().refreshLocalizedLists(next, next);
      },
      setArtworkLang: (artworkLang) => set({ artworkLang }),
      toggleArtworkLang: () =>
        set((s) => ({ artworkLang: s.artworkLang === "en" ? "ar" : s.artworkLang === "ar" ? "fa" : "en" })),
      setBilingual: (bilingual) => set({ bilingual }),
      toggleBilingual: () => set((s) => ({ bilingual: !s.bilingual })),

      /**
       * Re-fetches the localized title/overview/poster/backdrop for every
       * stored favorite and continue-watching item in the active language,
       * then updates the snapshots in place. Fire-and-forget; a stale fetch
       * that resolves after another language switch is discarded (the lang
       * guard prevents writing the wrong language back). Items that fail to
       * fetch keep their previous snapshot so a network blip never wipes a
       * user's lists.
       */
      refreshLocalizedLists: (lang, artworkLang) => {
        const { favorites, continueWatching } = get();
        const itemType = (media: TMDBMediaItem): MediaType =>
          media.media_type === "tv" || !!media.first_air_date ? "tv" : "movie";
        const fetchOne = async (media: TMDBMediaItem): Promise<TMDBMediaItem> => {
          const item = await fetchItem(media.id, itemType(media), { artworkLang, uiLang: lang });
          return item ?? media;
        };
        if (favorites.length > 0) {
          void Promise.all(favorites.map(fetchOne)).then((localized) => {
            if (get().lang === lang) set({ favorites: localized });
          });
        }
        if (continueWatching.length > 0) {
          void Promise.all(
            continueWatching.map(async (c) => ({ ...c, media: await fetchOne(c.media) }))
          ).then((updated) => {
            if (get().lang === lang) set({ continueWatching: updated });
          });
        }
      },

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
      importData: (data) => {
        set((s) => ({ ...s, ...sanitizePersisted(data, s) }));
        // Imported favorites / continue-watching snapshots may be in a
        // different language than the active one; refresh them to match.
        const { lang, artworkLang } = get();
        void get().refreshLocalizedLists(lang, artworkLang);
      },
      resetAll: () =>
        set({
          settings: DEFAULT_SETTINGS,
          theme: "dark",
          accent: "white",
          lang: "en",
          artworkLang: "en",
          bilingual: false,
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
      // (kept default above)
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
        favorites: s.favorites,
        continueWatching: s.continueWatching,
        activeServerId: s.activeServerId,
        settings: s.settings,
      }),
    }
  )
);

export function useIsFavorite(id: number | undefined): boolean {
  return useOnyxStore((s) => (id ? s.favorites.some((f) => f.id === id) : false));
}
