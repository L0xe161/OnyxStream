"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Heart, RotateCw, WifiOff } from "lucide-react";
import { Header } from "@/components/onyx/header";
import { HeroBanner } from "@/components/onyx/hero-banner";
import { CategoryRow } from "@/components/onyx/category-row";
import { UnifiedPlayer } from "@/components/onyx/unified-player";
import { MediaModal } from "@/components/onyx/media-modal";
import { SearchOverlay } from "@/components/onyx/search-overlay";
import { ContinueWatching } from "@/components/onyx/continue-watching";
import { GenreBrowser } from "@/components/onyx/genre-browser";
import { CatalogBrowser } from "@/components/onyx/catalog-browser";
import { PersonModal } from "@/components/onyx/person-modal";
import { SettingsSheet } from "@/components/onyx/settings-sheet";
import { CommandPalette } from "@/components/onyx/command-palette";
import { ShortcutsDialog } from "@/components/onyx/shortcuts-dialog";
import { Footer } from "@/components/onyx/footer";
import { EmptyState } from "@/components/onyx/empty-state";
import { CatalogSkeleton } from "@/components/onyx/skeletons";
import { MediaCard } from "@/components/onyx/media-card";
import { useOnyxStore } from "@/lib/store";
import { useCatalog, usePrefetchDetails } from "@/hooks/use-tmdb";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useUrlSync } from "@/hooks/use-url-sync";
import { useOnline } from "@/hooks/use-online";
import { useMotion } from "@/hooks/use-motion";
import { getT } from "@/lib/i18n";
import { startPlayback } from "@/lib/actions";
import { applyContentFilters, watchedIds } from "@/lib/content-filters";
import { isDiscoverTab, ROW_DEFINITIONS, TAB_VIEWS, type DiscoverTab } from "@/lib/home-rows";
import { rise, stagger } from "@/lib/motion";
import type { CatalogData, TMDBMediaItem, TMDBSearchPersonResult } from "@/lib/types";

export default function Home() {
  useKeyboardShortcuts();
  useUrlSync();

  const lang = useOnyxStore((s) => s.lang);
  const artworkLang = useOnyxStore((s) => s.artworkLang);
  const bilingual = useOnyxStore((s) => s.bilingual);
  const currentTab = useOnyxStore((s) => s.currentTab);
  const detailsMedia = useOnyxStore((s) => s.detailsMedia);
  const setDetailsMedia = useOnyxStore((s) => s.setDetailsMedia);

  const t = getT(lang);
  // On mount, refresh stored list snapshots (favorites + continue-watching)
  // so titles/overview/artwork left over from a previous language — or a
  // previous app version before this refresh existed — catch up to the
  // active interface language. Subsequent switches are handled by the
  // `setLang`/`toggleLang` actions themselves. No-op when both lists are
  // empty. Reads from `getState()` so the effect has no deps and runs once.
  useEffect(() => {
    const { lang: l, artworkLang: al } = useOnyxStore.getState();
    void useOnyxStore.getState().refreshLocalizedLists(l, al);
  }, []);
  const online = useOnline();
  const { reduced } = useMotion();
  const { data, loading, error, reload } = useCatalog(lang, artworkLang, bilingual);
  const prefetch = usePrefetchDetails(lang, artworkLang);

  const scrollByTab = useRef<Partial<Record<string, number>>>({});
  const tabRef = useRef(currentTab);

  // Keep the tab ref in lockstep with state, but only inside an effect so we
  // never mutate a ref during render (which would break React's expectations).
  useEffect(() => {
    tabRef.current = currentTab;
  }, [currentTab]);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        scrollByTab.current[tabRef.current] = window.scrollY;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const restoreScroll = useCallback(() => {
    window.scrollTo({ top: scrollByTab.current[tabRef.current] ?? 0, behavior: "instant" });
  }, []);

  const handlePlay = useCallback((media: TMDBMediaItem, season?: number, episode?: number, serverId?: string) => {
    startPlayback(media, season, episode, serverId);
  }, []);
  const handleSelectDetails = useCallback((media: TMDBMediaItem) => setDetailsMedia(media), [setDetailsMedia]);
  const handleSelectPerson = useCallback((person: TMDBSearchPersonResult) => {
    const state = useOnyxStore.getState();
    state.setActivePerson(person);
    state.setSearchOpen(false);
  }, []);

  const pageVariants = rise(reduced);

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <a href="#main" className="skip-link">{t.skipToContent}</a>
      <Header />

      {!online && (
        <div role="status" className="flex items-center justify-center gap-2 bg-muted px-4 py-2 text-meta">
          <WifiOff className="size-4" aria-hidden />
          <span className="font-medium">{t.offline}</span>
          <span className="text-muted-foreground max-sm:sr-only">{t.offlineSub}</span>
        </div>
      )}

      <main id="main" tabIndex={-1} className="flex-1 pb-24 outline-none lg:pb-0">
        <AnimatePresence mode="wait" initial={false} onExitComplete={restoreScroll}>
          <motion.div key={currentTab} variants={pageVariants} initial="hidden" animate="visible" exit="exit">
            {currentTab === "favorites" ? (
              <CollectionView lang={lang} bilingual={bilingual} onPlay={handlePlay} onSelectDetails={handleSelectDetails} onPrefetch={prefetch} />
            ) : loading ? (
              <CatalogSkeleton />
            ) : error || !data ? (
              <EmptyState
                icon={<AlertCircle className="size-8" aria-hidden />}
                title={t.errorLoading}
                action={{ label: t.retry, onClick: reload, icon: <RotateCw className="size-4" aria-hidden /> }}
              />
            ) : currentTab === "catalog" ? (
              <div className="mx-auto max-w-[110rem] px-[var(--gutter)] py-8">
                <CatalogBrowser genres={data.genres} lang={lang} bilingual={bilingual} onPlay={handlePlay} onSelectDetails={handleSelectDetails} />
              </div>
            ) : isDiscoverTab(currentTab) ? (
              <DiscoverView tab={currentTab} data={data} lang={lang} bilingual={bilingual} onPlay={handlePlay} onSelectDetails={handleSelectDetails} onPrefetch={prefetch} />
            ) : null}
          </motion.div>
        </AnimatePresence>
      </main>

      <Footer />

      <UnifiedPlayer lang={lang} />
      <MediaModal media={detailsMedia} onClose={() => setDetailsMedia(null)} onPlay={handlePlay} lang={lang} artworkLang={artworkLang} bilingual={bilingual} />
      <PersonModal lang={lang} bilingual={bilingual} onPlay={(m) => handlePlay(m)} onSelectDetails={handleSelectDetails} />
      <SearchOverlay onClose={() => useOnyxStore.getState().setSearchOpen(false)} onPlay={(m) => handlePlay(m)} onSelectDetails={handleSelectDetails} onSelectPerson={handleSelectPerson} />
      <SettingsSheet lang={lang} />
      <CommandPalette lang={lang} />
      <ShortcutsDialog lang={lang} />
    </div>
  );
}

interface ViewProps {
  lang: "en" | "ar";
  bilingual: boolean;
  onPlay: (media: TMDBMediaItem, season?: number, episode?: number, serverId?: string) => void;
  onSelectDetails: (media: TMDBMediaItem) => void;
  onPrefetch: (media: TMDBMediaItem) => void;
}

function DiscoverView({ tab, data, lang, bilingual, onPlay, onSelectDetails, onPrefetch }: ViewProps & { tab: DiscoverTab; data: CatalogData }) {
  const settings = useOnyxStore((s) => s.settings);
  const history = useOnyxStore((s) => s.continueWatching);
  const { reduced } = useMotion();
  const t = getT(lang);

  const view = TAB_VIEWS[tab];
  const watched = useMemo(() => watchedIds(history), [history]);
  const filter = useCallback((items: TMDBMediaItem[]) => applyContentFilters(items, settings, watched), [settings, watched]);

  // The user's chosen order and visibility, limited to the rows this tab owns.
  const rows = settings.homeRows.filter((r) => r.visible && view.rows.includes(r.id));
  const heroItems = useMemo(() => filter(view.hero(data)), [filter, view, data]);

  return (
    <motion.div variants={stagger(0.04)} initial="hidden" animate="visible">
      {settings.heroEnabled && heroItems.length > 0 && <HeroBanner items={heroItems} lang={lang} bilingual={bilingual} onPlay={(m) => onPlay(m)} onSelectDetails={onSelectDetails} />}

      <div className="mx-auto max-w-[110rem] space-y-[var(--space-section)] px-[var(--gutter)] py-[var(--space-section)]">
        {rows.map(({ id }) => {
          const definition = ROW_DEFINITIONS[id];
          return (
            <motion.div key={id} variants={rise(reduced)}>
              {id === "continue" ? (
                <ContinueWatching lang={lang} onPlay={onPlay} />
              ) : id === "genres" ? (
                <GenreBrowser genres={data.genres} lang={lang} bilingual={bilingual} onPlay={onPlay} onSelectDetails={onSelectDetails} />
              ) : definition ? (
                <CategoryRow title={t[definition.titleKey]} items={filter(definition.pick(data))} lang={lang} bilingual={bilingual} onPlay={onPlay} onSelectDetails={onSelectDetails} onPrefetch={onPrefetch} />
              ) : null}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

function CollectionView({ lang, bilingual, onPlay, onSelectDetails, onPrefetch }: ViewProps) {
  const t = getT(lang);
  const items = useOnyxStore((s) => s.favorites);
  const setCurrentTab = useOnyxStore((s) => s.setCurrentTab);
  const title = t.favorites;
  const Icon = Heart;

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Icon className="size-8" aria-hidden />}
        title={t.favoritesEmpty}
        description={t.favoritesEmptySub}
        action={{ label: t.backToCatalog, onClick: () => setCurrentTab("all") }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-[110rem] px-[var(--gutter)] py-10">
      <h1 className="mb-8 flex items-baseline gap-3 font-display text-headline">
        {title}
        <span className="text-title text-muted-foreground tabular-nums">{items.length}</span>
      </h1>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(var(--poster-w),1fr))] gap-x-4 gap-y-8">
        {items.map((item) => (
          <MediaCard key={item.id} media={item} lang={lang} bilingual={bilingual} onPlay={onPlay} onSelectDetails={onSelectDetails} onPrefetch={onPrefetch} />
        ))}
      </div>
    </div>
  );
}

