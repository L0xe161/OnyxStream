import type { HomeRowId } from "./settings";
import type { TranslationKey } from "./i18n";
import type { CatalogData, CategoryTab, TMDBMediaItem } from "./types";

export type DiscoverTab = Extract<CategoryTab, "all" | "movies" | "tv" | "anime" | "cartoons">;

interface RowDefinition {
  titleKey: TranslationKey;
  pick: (data: CatalogData) => TMDBMediaItem[];
}

/** Rows that render a poster list. `continue` and `genres` are special sections. */
export const ROW_DEFINITIONS: Partial<Record<HomeRowId, RowDefinition>> = {
  trending: { titleKey: "trendingToday", pick: (d) => d.trending },
  movies: { titleKey: "popularMovies", pick: (d) => d.movies },
  tv: { titleKey: "popularSeries", pick: (d) => d.tvShows },
  anime: { titleKey: "topAnime", pick: (d) => d.anime },
  cartoons: { titleKey: "classicCartoons", pick: (d) => d.cartoons },
  topMovies: { titleKey: "topRatedMovies", pick: (d) => d.topRatedMovies },
  topTV: { titleKey: "topRatedTV", pick: (d) => d.topRatedTV },
  upcoming: { titleKey: "upcoming", pick: (d) => d.upcoming },
};

/** What each discover tab shows: its hero source and which rows belong to it. */
export const TAB_VIEWS: Record<DiscoverTab, { hero: (d: CatalogData) => TMDBMediaItem[]; rows: readonly HomeRowId[] }> = {
  all: {
    hero: (d) => d.trending,
    rows: ["continue", "trending", "movies", "tv", "anime", "cartoons", "topMovies", "topTV", "upcoming", "genres"],
  },
  movies: { hero: (d) => d.movies, rows: ["continue", "movies", "topMovies", "upcoming", "genres"] },
  tv: { hero: (d) => d.tvShows, rows: ["continue", "tv", "topTV", "genres"] },
  anime: { hero: (d) => d.anime, rows: ["anime"] },
  cartoons: { hero: (d) => d.cartoons, rows: ["cartoons"] },
};

export const isDiscoverTab = (tab: CategoryTab): tab is DiscoverTab => tab in TAB_VIEWS;
