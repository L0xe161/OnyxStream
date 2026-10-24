import { sanitizePersisted, STORE_VERSION, type OnyxState } from "./store";

export const EXPORT_APP = "onyxstream";

const EXPORT_KEYS = [
  "lang", "artworkLang", "bilingual", "theme", "accent", "activeServerId",
  "favorites", "continueWatching", "settings",
] as const satisfies readonly (keyof OnyxState)[];

export interface ExportFile {
  app: typeof EXPORT_APP;
  version: number;
  exportedAt: string;
  state: Record<string, unknown>;
}

/** Everything the user owns: preferences, lists and history. */
export function buildExport(state: OnyxState, now: Date = new Date()): ExportFile {
  const picked: Record<string, unknown> = {};
  for (const key of EXPORT_KEYS) picked[key] = state[key];
  return { app: EXPORT_APP, version: STORE_VERSION, exportedAt: now.toISOString(), state: picked };
}

/**
 * Parses an exported file. Accepts the wrapped format and a bare state object,
 * and returns null for anything that is not recognisably ours so a wrong file
 * can never wipe existing data.
 */
export function parseImport(text: string): ReturnType<typeof sanitizePersisted> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const root = parsed as Record<string, unknown>;
  const candidate = (typeof root.state === "object" && root.state !== null ? root.state : root) as Record<string, unknown>;
  if (!EXPORT_KEYS.some((key) => key in candidate)) return null;
  return sanitizePersisted(candidate as Parameters<typeof sanitizePersisted>[0], null);
}
