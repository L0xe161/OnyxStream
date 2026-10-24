import type { TranslationKey } from "./i18n";
import { TAB_DEFINITIONS } from "./tabs";

export interface ShortcutInfo {
  keys: string[];
  labelKey: TranslationKey;
}

/** The single list shown in the cheat-sheet; the handler implements exactly these. */
export const GLOBAL_SHORTCUTS: ShortcutInfo[] = [
  { keys: ["/"], labelKey: "shortcutSearch" },
  { keys: ["⌘/Ctrl", "K"], labelKey: "shortcutPalette" },
  { keys: [","], labelKey: "shortcutSettings" },
  { keys: ["?"], labelKey: "shortcutHelp" },
  { keys: ["Esc"], labelKey: "shortcutClose" },
];

export const TAB_SHORTCUTS: ShortcutInfo[] = TAB_DEFINITIONS.map((tab) => ({
  keys: [tab.shortcut],
  labelKey: tab.labelKey,
}));
