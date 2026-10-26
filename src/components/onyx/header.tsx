"use client";

import { Languages, MoreHorizontal, Search, SlidersHorizontal } from "lucide-react";
import { motion } from "framer-motion";
import { useOnyxStore } from "@/lib/store";
import { getT, languageNativeLabel, nextLanguage } from "@/lib/i18n";
import { useNavTabs } from "@/hooks/use-nav-tabs";
import { transition } from "@/lib/motion";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { TabDefinition } from "@/lib/tabs";

const barButton =
  "inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-medium text-foreground/80 transition-colors hover:bg-foreground/8 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2";

/** Flat typographic monogram; no gradient, shadow or pulse. */
function Wordmark({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-2.5 rounded-full pe-2 focus-visible:outline-2 focus-visible:outline-offset-4" aria-label={label}>
      <span className="grid size-8 place-items-center rounded-full bg-foreground font-display text-[0.8125rem] font-semibold tracking-tight text-background" aria-hidden>
        OX
      </span>
      <span className="font-display text-xl font-medium tracking-tight">{label}</span>
    </button>
  );
}

function MoreMenu({ items, label, current, onSelect, counts, side }: { items: TabDefinition[]; label: string; current: string; onSelect: (id: TabDefinition["id"]) => void; counts: Record<string, number>; side: "bottom" | "top" }) {
  const t = getT(useOnyxStore((s) => s.lang));
  if (items.length === 0) return null;
  const active = items.some((i) => i.id === current);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(barButton, active && "text-foreground")} aria-label={label}>
        <MoreHorizontal className="size-5" aria-hidden />
        <span className="max-lg:sr-only">{label}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side={side} className="min-w-48">
        {items.map((item) => (
          <DropdownMenuItem key={item.id} onSelect={() => onSelect(item.id)} className="justify-between gap-6" aria-current={item.id === current ? "page" : undefined}>
            <span>{t[item.labelKey]}</span>
            {counts[item.id] > 0 && <span className="text-muted-foreground tabular-nums">{counts[item.id]}</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Header() {
  const lang = useOnyxStore((s) => s.lang);
  const currentTab = useOnyxStore((s) => s.currentTab);
  const setCurrentTab = useOnyxStore((s) => s.setCurrentTab);
  const toggleLang = useOnyxStore((s) => s.toggleLang);
  const toggleSearch = useOnyxStore((s) => s.toggleSearch);
  const setSettingsOpen = useOnyxStore((s) => s.setSettingsOpen);
  const favoriteCount = useOnyxStore((s) => s.favorites.length);
  const counts = { favorites: favoriteCount };
  const t = getT(lang);

  const desktop = useNavTabs(5);
  // Mobile shows all 5 primary tabs (Home, Movies, TV, Anime, Catalog) so the
  // Catalog tab sits next to the others in the bottom bar instead of being
  // buried in the "More" (•••) overflow menu. "More" keeps the non-primary
  // tabs (Cartoons, Favorites).
  const mobile = useNavTabs(5);

  return (
    <>
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[110rem] items-center gap-3 px-[var(--gutter)] sm:gap-4">
          {/* Start cluster: brand. flex-1 keeps the nav optically centred. */}
          <div className="flex min-w-0 flex-1 items-center">
            <Wordmark label={t.siteTitle} onClick={() => setCurrentTab("all")} />
          </div>

          {/* Centre cluster: primary tabs, shrunk only when unavoidable. */}
          <nav aria-label={t.primaryNav} className="hidden shrink-0 items-center gap-1 lg:flex">
            {desktop.primary.map((tab) => {
              const active = currentTab === tab.id;
              return (
                <button key={tab.id} type="button" onClick={() => setCurrentTab(tab.id)} aria-current={active ? "page" : undefined} className={cn(barButton, "relative", active && "text-foreground")}>
                  {t[tab.labelKey]}
                  {active && <motion.span layoutId="nav-underline" transition={transition.spring} className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-[var(--primary)]" />}
                </button>
              );
            })}
            <MoreMenu items={desktop.overflow} label={t.moreTabs} current={currentTab} onSelect={setCurrentTab} counts={counts} side="bottom" />
          </nav>

          {/* End cluster: search, language and settings sit together, evenly
              spaced and end-aligned so the search control feels part of the
              same bar instead of floating apart from it. */}
          <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
            <button type="button" onClick={toggleSearch} className={cn(barButton, "shrink-0")} aria-label={t.openSearch} title={t.searchShortcut}>
              <Search className="size-5" aria-hidden />
              <span className="max-xl:sr-only">{t.searchShort}</span>
            </button>
            <button type="button" onClick={toggleLang} className={cn(barButton, "max-sm:hidden shrink-0")} aria-label={t.langToggleLabel}>
              <Languages className="size-5" aria-hidden />
              <span>{languageNativeLabel(nextLanguage(lang))}</span>
            </button>
            <button type="button" onClick={() => setSettingsOpen(true)} className={cn(barButton, "shrink-0")} aria-label={t.openSettings} title={t.openSettings}>
              <SlidersHorizontal className="size-5" aria-hidden />
            </button>
          </div>
        </div>
      </header>

      {/* Phones: a bottom tab bar, safe-area aware, in thumb reach. */}
      <nav aria-label={t.primaryNav} className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] lg:hidden">
        <ul className="mx-auto flex max-w-xl items-stretch justify-around px-2">
          {mobile.primary.map((tab) => {
            const active = currentTab === tab.id;
            return (
              <li key={tab.id} className="flex-1">
                <button type="button" onClick={() => setCurrentTab(tab.id)} aria-current={active ? "page" : undefined} className={cn("relative flex h-14 w-full items-center justify-center whitespace-nowrap text-[0.8125rem] font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-4", active ? "text-foreground" : "text-muted-foreground")}>
                  {t[tab.labelKey]}
                  {active && <motion.span layoutId="nav-tab-mobile" transition={transition.spring} className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-[var(--primary)]" />}
                </button>
              </li>
            );
          })}
          <li className="flex flex-1 items-center justify-center">
            <MoreMenu items={mobile.overflow} label={t.moreTabs} current={currentTab} onSelect={setCurrentTab} counts={counts} side="top" />
          </li>
        </ul>
      </nav>
    </>
  );
}
