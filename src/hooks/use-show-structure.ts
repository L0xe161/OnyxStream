"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchShowStructure } from "@/lib/tmdb";
import type { Language, TMDBSeasonSummary } from "@/lib/types";

/** Season and episode counts straight from TMDB; de-duplicated and cached by React Query. */
export function useShowStructure(tvId: number | undefined, lang: Language) {
  return useQuery<TMDBSeasonSummary[]>({
    queryKey: ["tv-structure", tvId, lang],
    enabled: typeof tvId === "number",
    staleTime: 60 * 60_000,
    queryFn: () => fetchShowStructure(tvId as number, { uiLang: lang }),
  });
}
