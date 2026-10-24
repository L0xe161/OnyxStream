import type { CategoryTab } from "./types";
import type { TranslationKey } from "./i18n";

export interface TabDefinition {
  id: CategoryTab;
  labelKey: TranslationKey;
  /** Keyboard shortcut (single key, no modifier). */
  shortcut: string;
  /** Shown directly in the navigation bar; the rest live under "More". */
  primary: boolean;
}

export const TAB_DEFINITIONS: readonly TabDefinition[] = [
  { id: "all", labelKey: "navAll", shortcut: "1", primary: true },
  { id: "movies", labelKey: "navMovies", shortcut: "2", primary: true },
  { id: "tv", labelKey: "navTV", shortcut: "3", primary: true },
  { id: "anime", labelKey: "navAnime", shortcut: "4", primary: true },
  { id: "cartoons", labelKey: "navCartoons", shortcut: "5", primary: false },
  { id: "catalog", labelKey: "navCatalog", shortcut: "6", primary: true },
  { id: "favorites", labelKey: "navFavorites", shortcut: "7", primary: false },
  { id: "watchlist", labelKey: "navWatchlist", shortcut: "8", primary: false },
];

export const TAB_IDS: readonly CategoryTab[] = TAB_DEFINITIONS.map((t) => t.id);

export function isCategoryTab(value: unknown): value is CategoryTab {
  return typeof value === "string" && (TAB_IDS as readonly string[]).includes(value);
}

export function getTab(id: CategoryTab): TabDefinition {
  return TAB_DEFINITIONS.find((t) => t.id === id) ?? TAB_DEFINITIONS[0];
}
