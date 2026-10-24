"use client";

import { useMemo } from "react";
import { useOnyxStore } from "@/lib/store";
import { TAB_DEFINITIONS, type TabDefinition } from "@/lib/tabs";

/**
 * Resolves which tabs show in the bar and which fall under "More", honouring
 * the order and visibility the user chose in Settings.
 */
export function useNavTabs(primaryLimit: number) {
  const tabs = useOnyxStore((s) => s.settings.tabs);

  return useMemo(() => {
    const visible = tabs
      .filter((t) => t.visible)
      .map((t) => TAB_DEFINITIONS.find((d) => d.id === t.id))
      .filter((d): d is TabDefinition => !!d);
    const primary = visible.filter((d) => d.primary).slice(0, primaryLimit);
    const overflow = visible.filter((d) => !primary.includes(d));
    return { primary, overflow, visible };
  }, [tabs, primaryLimit]);
}
