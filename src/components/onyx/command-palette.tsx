"use client";

import { useState } from "react";
import { CircleHelp, Globe, LayoutGrid, Moon, Search, SlidersHorizontal } from "lucide-react";
import { Overlay } from "./overlay";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from "@/components/ui/command";
import { useOnyxStore } from "@/lib/store";
import { dirFor, getT } from "@/lib/i18n";
import { TAB_DEFINITIONS } from "@/lib/tabs";
import type { ThemeMode } from "@/lib/themes";
import type { Language } from "@/lib/types";

const THEME_ORDER: ThemeMode[] = ["dark", "light", "frosted"];

/** ⌘/Ctrl+K: jump anywhere, search, or flip a preference without leaving the keyboard. */
export function CommandPalette({ lang }: { lang: Language }) {
  const open = useOnyxStore((s) => s.paletteOpen);
  const setOpen = useOnyxStore((s) => s.setPaletteOpen);
  const visibleTabs = useOnyxStore((s) => s.settings.tabs);
  const [query, setQuery] = useState("");
  const t = getT(lang);

  const run = (action: () => void) => {
    setOpen(false);
    setQuery("");
    action();
  };

  const store = () => useOnyxStore.getState();
  const tabs = visibleTabs
    .filter((x) => x.visible)
    .map((x) => TAB_DEFINITIONS.find((d) => d.id === x.id))
    .filter((d): d is (typeof TAB_DEFINITIONS)[number] => !!d);

  return (
    <Overlay
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
      title={t.shortcutPalette}
      dir={dirFor(lang)}
      className="!inset-x-4 !top-[12svh] !bottom-auto !max-w-xl overflow-hidden sm:!inset-y-auto sm:!top-[12svh]"
    >
      <Command className="bg-transparent" loop>
        <CommandInput value={query} onValueChange={setQuery} placeholder={t.paletteHint} dir="auto" />
        <CommandList className="max-h-[min(24rem,60svh)]">
          <CommandEmpty>{t.paletteEmpty}</CommandEmpty>

          {query.trim() && (
            <CommandGroup heading={t.shortcutSearch}>
              <CommandItem
                value={`search-${query}`}
                forceMount
                onSelect={() =>
                  run(() => {
                    store().setSearchQuery(query.trim());
                    store().setSearchOpen(true);
                  })
                }
              >
                <Search aria-hidden />
                <span dir="auto">“{query.trim()}”</span>
              </CommandItem>
            </CommandGroup>
          )}

          <CommandGroup heading={t.paletteGoTo}>
            {tabs.map((tab) => (
              <CommandItem key={tab.id} value={`go ${t[tab.labelKey]}`} onSelect={() => run(() => store().setCurrentTab(tab.id))}>
                <LayoutGrid aria-hidden />
                {t[tab.labelKey]}
                <CommandShortcut>{tab.shortcut}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading={t.paletteActions}>
            <CommandItem value={t.shortcutSearch} onSelect={() => run(() => store().setSearchOpen(true))}>
              <Search aria-hidden />
              {t.shortcutSearch}
              <CommandShortcut>/</CommandShortcut>
            </CommandItem>
            <CommandItem value={t.openSettings} onSelect={() => run(() => store().setSettingsOpen(true))}>
              <SlidersHorizontal aria-hidden />
              {t.openSettings}
              <CommandShortcut>,</CommandShortcut>
            </CommandItem>
            <CommandItem
              value={t.toggleTheme}
              onSelect={() =>
                run(() => {
                  const s = store();
                  const next = THEME_ORDER[(THEME_ORDER.indexOf(s.theme) + 1) % THEME_ORDER.length];
                  s.updateSettings({ followSystemTheme: false });
                  s.setTheme(next);
                })
              }
            >
              <Moon aria-hidden />
              {t.toggleTheme}
            </CommandItem>
            <CommandItem value={t.toggleLanguage} onSelect={() => run(() => store().toggleLang())}>
              <Globe aria-hidden />
              {t.toggleLanguage}
            </CommandItem>
            <CommandItem value={t.shortcutsTitle} onSelect={() => run(() => store().setShortcutsOpen(true))}>
              <CircleHelp aria-hidden />
              {t.shortcutsTitle}
              <CommandShortcut>?</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </Overlay>
  );
}
