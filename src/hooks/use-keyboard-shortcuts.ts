"use client";

import { useEffect } from "react";
import { useOnyxStore } from "@/lib/store";
import { TAB_DEFINITIONS } from "@/lib/tabs";

const isTypingTarget = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
};

/**
 * Global shortcuts. Implements exactly the list in `lib/shortcuts.ts`.
 * Escape is handled by each Radix dialog itself (and exits fullscreen first).
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const s = useOnyxStore.getState();

      // The command palette opens from anywhere, even while typing.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        s.setPaletteOpen(!s.paletteOpen);
        return;
      }

      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented || isTypingTarget(e.target)) return;

      const overlayOpen =
        !!s.detailsMedia || !!s.activeMedia || !!s.activePerson || s.isSearchOpen || s.settingsOpen || s.paletteOpen || s.shortcutsOpen;
      if (overlayOpen) return;

      if (e.key === "/") {
        e.preventDefault();
        s.setSearchOpen(true);
      } else if (e.key === ",") {
        e.preventDefault();
        s.setSettingsOpen(true);
      } else if (e.key === "?") {
        e.preventDefault();
        s.setShortcutsOpen(true);
      } else {
        const tab = TAB_DEFINITIONS.find((d) => d.shortcut === e.key);
        if (tab) {
          e.preventDefault();
          s.setCurrentTab(tab.id);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
