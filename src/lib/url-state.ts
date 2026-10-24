import type { CategoryTab, MediaType, SortOption } from "./types";
import { isCategoryTab } from "./tabs";

/**
 * Everything that should survive a refresh, a shared link and the Back button.
 * Kept as plain data with pure encode/decode so it can be tested without a DOM.
 */
export interface MediaRef {
  type: MediaType;
  id: number;
}

export interface CatalogState {
  type: MediaType;
  genreIds: number[];
  yearFrom?: number;
  yearTo?: number;
  minRating: number;
  originalLanguage: string;
  sortBy: SortOption;
}

export interface UrlSnapshot {
  tab: CategoryTab;
  details: MediaRef | null;
  play: (MediaRef & { season: number; episode: number; server?: string }) | null;
  person: number | null;
  /** null = search closed; a string (possibly empty) = open with that query. */
  search: string | null;
  catalog: CatalogState;
}

export const DEFAULT_CATALOG: CatalogState = {
  type: "movie",
  genreIds: [],
  minRating: 0,
  originalLanguage: "",
  sortBy: "popularity.desc",
};

export const SORT_VALUES: readonly SortOption[] = [
  "popularity.desc", "popularity.asc", "vote_average.desc", "vote_average.asc",
  "primary_release_date.desc", "primary_release_date.asc", "title.asc", "title.desc",
];

const int = (v: string | null, min: number, max: number): number | undefined => {
  if (v === null || !/^\d{1,9}$/.test(v)) return undefined;
  const n = Number(v);
  return n >= min && n <= max ? n : undefined;
};

function parseRef(v: string | null): MediaRef | null {
  const m = /^(movie|tv)-(\d{1,9})$/.exec(v ?? "");
  return m ? { type: m[1] as MediaType, id: Number(m[2]) } : null;
}

const formatRef = (r: MediaRef) => `${r.type}-${r.id}`;

export function decodeUrl(search: string): UrlSnapshot {
  const q = new URLSearchParams(search);
  const tabParam = q.get("tab");
  const play = parseRef(q.get("play"));
  const sort = q.get("sort") as SortOption | null;
  const type = q.get("type");

  return {
    tab: isCategoryTab(tabParam) ? tabParam : "all",
    details: parseRef(q.get("title")),
    play: play
      ? {
          ...play,
          season: int(q.get("s"), 1, 999) ?? 1,
          episode: int(q.get("e"), 1, 9999) ?? 1,
          server: /^[a-z0-9]{2,24}$/.test(q.get("srv") ?? "") ? (q.get("srv") as string) : undefined,
        }
      : null,
    person: int(q.get("person"), 1, 999_999_999) ?? null,
    search: q.has("q") ? (q.get("q") ?? "").slice(0, 100) : null,
    catalog: {
      type: type === "tv" ? "tv" : "movie",
      genreIds: (q.get("genres") ?? "")
        .split(",")
        .filter((g) => /^\d{1,5}$/.test(g))
        .map(Number)
        .slice(0, 10),
      yearFrom: int(q.get("from"), 1888, 2100),
      yearTo: int(q.get("to"), 1888, 2100),
      minRating: /^(10|\d)(\.\d)?$/.test(q.get("rating") ?? "") ? Number(q.get("rating")) : 0,
      originalLanguage: /^[a-z]{2}$/.test(q.get("lang") ?? "") ? (q.get("lang") as string) : "",
      sortBy: sort && SORT_VALUES.includes(sort) ? sort : "popularity.desc",
    },
  };
}

/** Builds the query string for a snapshot, omitting anything that is a default. */
export function encodeUrl(snap: UrlSnapshot): string {
  const q = new URLSearchParams();
  if (snap.tab !== "all") q.set("tab", snap.tab);
  if (snap.tab === "catalog") {
    const c = snap.catalog;
    if (c.type !== DEFAULT_CATALOG.type) q.set("type", c.type);
    if (c.genreIds.length) q.set("genres", c.genreIds.join(","));
    if (c.yearFrom) q.set("from", String(c.yearFrom));
    if (c.yearTo) q.set("to", String(c.yearTo));
    if (c.minRating) q.set("rating", String(c.minRating));
    if (c.originalLanguage) q.set("lang", c.originalLanguage);
    if (c.sortBy !== DEFAULT_CATALOG.sortBy) q.set("sort", c.sortBy);
  }
  if (snap.details) q.set("title", formatRef(snap.details));
  if (snap.play) {
    q.set("play", formatRef(snap.play));
    if (snap.play.type === "tv") {
      q.set("s", String(snap.play.season));
      q.set("e", String(snap.play.episode));
    }
    if (snap.play.server) q.set("srv", snap.play.server);
  }
  if (snap.person) q.set("person", String(snap.person));
  if (snap.search !== null) q.set("q", snap.search);
  const out = q.toString();
  return out ? `?${out}` : "";
}

/** Changes that should add a history entry (Back undoes them), vs. ones that only replace it. */
export function navigationKey(snap: UrlSnapshot): string {
  return JSON.stringify([
    snap.tab,
    snap.details && formatRef(snap.details),
    snap.play && formatRef(snap.play),
    snap.person,
    snap.search !== null,
  ]);
}
