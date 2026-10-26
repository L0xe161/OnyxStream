import { contrastRatio, ensureContrast, parseHex, readableInk } from "./color";

export type ThemeMode = "dark" | "light" | "frosted";

export type AccentColor =
  | "white"
  | "cyan"
  | "teal"
  | "violet"
  | "rose"
  | "amber"
  | "emerald"
  | "blue"
  | "orange";

export interface AccentDef {
  id: AccentColor;
  label: string;
  labelAr: string;
  labelFa: string;
  /** main accent (primary) */
  color: string;
  /** darker hover (accent) */
  hover: string;
  /** soft background tint for badges */
  tint: string;
}

export const ACCENTS: AccentDef[] = [
  { id: "white", label: "White", labelAr: "أبيض", labelFa: "سفید", color: "#ffffff", hover: "#d4d4d4", tint: "rgba(255,255,255,0.16)" },
  { id: "cyan", label: "Cyan", labelAr: "سماوي", labelFa: "فیروزه‌ای", color: "#06b6d4", hover: "#0e7490", tint: "rgba(6,182,212,0.15)" },
  { id: "teal", label: "Teal", labelAr: "فيروزي", labelFa: "سبز مایل به آبی", color: "#14b8a6", hover: "#0f766e", tint: "rgba(20,184,166,0.15)" },
  { id: "violet", label: "Violet", labelAr: "بنفسجي", labelFa: "بنفش", color: "#8b5cf6", hover: "#6d28d9", tint: "rgba(139,92,246,0.15)" },
  { id: "rose", label: "Rose", labelAr: "وردي", labelFa: "رز", color: "#f43f5e", hover: "#be123c", tint: "rgba(244,63,94,0.15)" },
  { id: "amber", label: "Amber", labelAr: "كهرماني", labelFa: "کهربایی", color: "#f59e0b", hover: "#b45309", tint: "rgba(245,158,11,0.15)" },
  { id: "emerald", label: "Emerald", labelAr: "زمردي", labelFa: "سبز زمردی", color: "#10b981", hover: "#047857", tint: "rgba(16,185,129,0.15)" },
  { id: "blue", label: "Blue", labelAr: "أزرق", labelFa: "آبی", color: "#3b82f6", hover: "#1d4ed8", tint: "rgba(59,130,246,0.15)" },
  { id: "orange", label: "Orange", labelAr: "برتقالي", labelFa: "نارنجی", color: "#fb923c", hover: "#c2410c", tint: "rgba(251,146,60,0.15)" },
];

export const THEME_MODES: { id: ThemeMode; label: string; labelAr: string; labelFa: string; icon: string }[] = [
  { id: "dark", label: "Dark", labelAr: "داكن", labelFa: "تیره", icon: "moon" },
  { id: "light", label: "Light", labelAr: "فاتح", labelFa: "روشن", icon: "sun" },
  { id: "frosted", label: "Frosted", labelAr: "زجاجي", labelFa: "شیشه‌ای", icon: "sparkles" },
];

export function getAccent(id: AccentColor): AccentDef {
  return ACCENTS.find((a) => a.id === id) ?? ACCENTS[0];
}

/**
 * The least favourable surface an accent can sit on in each theme (the lightest
 * surface in dark themes, the darkest in the light theme). Accent text is
 * guaranteed to meet WCAG AA against this colour, so it passes on every
 * lighter/darker surface too.
 */
export const WORST_SURFACE: Record<ThemeMode, string> = {
  dark: "#1d1d21",
  light: "#ebe7dd",
  frosted: "#262a38",
};

export const BROWSER_CHROME: Record<ThemeMode, string> = {
  dark: "#0a0a0b",
  light: "#f4f1ea",
  frosted: "#0b0d16",
};

export interface ResolvedAccent {
  /** Fill and text colour for accent elements; always >= 4.5:1 on the worst surface. */
  primary: string;
  /** Ink to place on top of `primary`; always >= 4.5:1 against it. */
  onPrimary: "#000000" | "#ffffff";
  /** Hover state: nudged further from the surface. */
  hover: string;
  /** Soft tint for backgrounds. */
  tint: string;
  /** True when the requested colour had to be adjusted for legibility. */
  adjusted: boolean;
}

/** Turns a requested accent into a colour that is legible in the given theme. */
export function resolveAccent(requested: string, theme: ThemeMode): ResolvedAccent {
  const surface = parseHex(WORST_SURFACE[theme]) ?? [0, 0, 0];
  const base = parseHex(requested) ?? parseHex(ACCENTS[0].color) ?? [6, 182, 212];
  const primary = ensureContrast(requested, surface, 4.5);
  const rgb = parseHex(primary) ?? base;
  const hover = ensureContrast(primary, surface, 6);
  return {
    primary,
    onPrimary: readableInk(rgb),
    hover,
    tint: `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.16)`,
    adjusted: primary.toLowerCase() !== requested.toLowerCase(),
  };
}

export function accentContrast(theme: ThemeMode, hex: string): number {
  const surface = parseHex(WORST_SURFACE[theme]);
  const rgb = parseHex(hex);
  return surface && rgb ? contrastRatio(rgb, surface) : 0;
}
