"use client";

import { useQuery } from "@tanstack/react-query";
import type { Language, TMDBMediaItem, TMDBTranslation } from "@/lib/types";

// Translations don't change once produced; cache them indefinitely so each
// tagline is translated at most once per (text, language) pair per session.
const TRANSLATE_STALE_MS = Infinity;

/**
 * Machine-translates a short string (a movie tagline) to the target language
 * via the `/api/translate` route (z-ai-web-dev-sdk LLM). Returns `undefined`
 * while the translation is in flight — and on failure — so the caller can hide
 * the element until a localized value lands, never flashing the English source
 * in an RTL UI.
 *
 * No-op (returns the original text) when the target is English or the input is
 * empty, so no fetch is made in those cases.
 */
export function useTranslatedText(text: string, to: Language): string | undefined {
  const enabled = !!text && to !== "en";
  const query = useQuery({
    queryKey: ["translate", text, to],
    queryFn: async () => {
      try {
        const res = await fetch(`/api/translate?text=${encodeURIComponent(text)}&to=${to}`);
        if (!res.ok) return "";
        const data = (await res.json()) as { translated?: string };
        const translated = data?.translated;
        return translated && translated.trim() ? translated : "";
      } catch {
        return "";
      }
    },
    enabled,
    staleTime: TRANSLATE_STALE_MS,
    gcTime: 30 * 60_000,
    retry: 1,
  });
  if (!enabled) return text || undefined;
  const result = query.data;
  return result && result.trim() ? result : undefined;
}

function findTranslation(
  list: TMDBTranslation[] | undefined,
  lang: string
): TMDBTranslation | undefined {
  return list?.find((t) => t.iso_639_1 === lang);
}

/**
 * Resolves the best tagline for the active UI language, using the translations
 * table bundled in `append_to_response=translations`:
 *  1. If the requested language's translation has a tagline → use it (already
 *     localized by TMDB).
 *  2. Else if the UI is English → show the English tagline as-is.
 *  3. Else (non-English UI, no localized tagline) → machine-translate the
 *     English tagline via the LLM so it appears in Persian/Arabic.
 *  4. Else → `undefined` (no tagline element rendered).
 *
 * While the LLM translation is in flight, returns `undefined` so the tagline is
 * hidden rather than flashing English.
 */
export function useLocalizedTagline(item: TMDBMediaItem, uiLang: Language): string | undefined {
  const list = item.translations?.translations;
  const localized = findTranslation(list, uiLang)?.data.tagline?.trim();
  const english =
    findTranslation(list, "en")?.data.tagline?.trim() ?? item.tagline?.trim() ?? "";

  // Always call the translation hook (rules of hooks). Pass "" when no
  // translation is needed (localized already exists, English UI, or no English
  // source to translate).
  const needsTranslation = !localized && !!english && uiLang !== "en";
  const translated = useTranslatedText(needsTranslation ? english : "", uiLang);

  if (localized) return localized;
  if (uiLang === "en") return english || undefined;
  return translated; // undefined while loading / on failure; the translation otherwise
}
