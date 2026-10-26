export type MediaType = "movie" | "tv";

export type CategoryTab =
  | "all"
  | "movies"
  | "tv"
  | "anime"
  | "cartoons"
  | "catalog"
  | "favorites";

export type Language = "en" | "ar" | "fa";
export type ArtworkLanguage = "en" | "ar" | "fa";

export interface TMDBMediaItem {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  adult?: boolean;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  release_date?: string;
  first_air_date?: string;
  media_type?: MediaType;
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
  original_language?: string;
  number_of_seasons?: number;
  number_of_episodes?: number;
  seasons?: TMDBSeasonSummary[];
  /** TV series creators (from the details endpoint). */
  created_by?: { id: number; name: string; profile_path: string | null }[];
  runtime?: number;
  episode_run_time?: number[];
  status?: string;
  tagline?: string;
  homepage?: string;
  production_companies?: { id: number; name: string; logo_path: string | null }[];
  spoken_languages?: { english_name: string; name: string; iso_639_1: string }[];
  credits?: {
    cast: TMDBCastMember[];
    crew: TMDBCrewMember[];
  };
  recommendations?: {
    results: TMDBMediaItem[];
  };
  similar?: {
    results: TMDBMediaItem[];
  };
  videos?: {
    results: TMDBVideo[];
  };
  images?: TMDBImagesResponse;
  /** Full translations table (from `append_to_response=translations`). Used
   * to fall back to the English title/overview/tagline when the requested
   * language has no translation for a title. */
  translations?: TMDBTranslationsResponse;
  // runtime helpers added by service
  __runtime?: number;
  // Bilingual title fields (filled when bilingual mode is on)
  title_en?: string;
  title_ar?: string;
  title_fa?: string;
  name_en?: string;
  name_ar?: string;
  name_fa?: string;
  overview_en?: string;
  overview_ar?: string;
  overview_fa?: string;
}

export interface TMDBCastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
  gender?: number;
}

export interface TMDBCrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export interface TMDBVideo {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
  published_at?: string;
}

export interface TMDBEpisode {
  id: number;
  name: string;
  overview: string;
  episode_number: number;
  season_number: number;
  still_path: string | null;
  air_date?: string;
  vote_average?: number;
  runtime?: number;
}

export interface TMDBSeasonSummary {
  id: number;
  name: string;
  season_number: number;
  episode_count: number;
  air_date?: string | null;
  poster_path?: string | null;
}

export interface TMDBSeasonDetails {
  id: number;
  name: string;
  season_number: number;
  episodes: TMDBEpisode[];
  poster_path: string | null;
  air_date?: string;
  overview?: string;
}

export interface TMDBImageItem {
  file_path: string;
  iso_639_1: string | null;
  aspect_ratio: number;
  vote_average: number;
}

export interface TMDBImagesResponse {
  id: number;
  backdrops: TMDBImageItem[];
  posters: TMDBImageItem[];
  logos: TMDBImageItem[];
}

/** A single localized translation entry from `append_to_response=translations`. */
export interface TMDBTranslation {
  iso_639_1: string;
  iso_3166_1: string;
  name?: string;
  english_name?: string;
  data: {
    title?: string;
    name?: string;
    overview?: string;
    tagline?: string;
    homepage?: string;
  };
}

/** The translations table returned by `append_to_response=translations`. */
export interface TMDBTranslationsResponse {
  id: number;
  translations: TMDBTranslation[];
}

export interface TMDBPerson {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department?: string;
  birthday?: string;
  deathday?: string | null;
  place_of_birth?: string;
  biography?: string;
  gender?: number;
  popularity?: number;
  media_type?: "person";
  known_for?: TMDBMediaItem[];
}

export interface TMDBPersonCastCredit {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  character?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  media_type: MediaType;
  episode_count?: number;
  order?: number;
}

export interface TMDBPersonCrewCredit {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  job: string;
  department: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  media_type: MediaType;
}

export interface TMDBPersonCredits {
  id: number;
  cast: TMDBPersonCastCredit[];
  crew: TMDBPersonCrewCredit[];
}

export interface TMDBSearchPersonResult {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department: string;
  known_for: TMDBMediaItem[];
  media_type: "person";
}

export interface CatalogFilters {
  type: MediaType;
  genreIds: number[];
  yearFrom?: number;
  yearTo?: number;
  minRating?: number;
  originalLanguage?: string;
  /** ISO-3166-1; sent as `region` to TMDB discover (affects release dates & availability). */
  region?: string;
  sortBy: SortOption;
  page: number;
}

export type SortOption =
  | "popularity.desc"
  | "popularity.asc"
  | "vote_average.desc"
  | "vote_average.asc"
  | "primary_release_date.desc"
  | "primary_release_date.asc"
  | "first_air_date.desc"
  | "first_air_date.asc"
  | "title.asc"
  | "title.desc";

export interface TMDBGenre {
  id: number;
  name: string;
}

export interface CatalogData {
  trending: TMDBMediaItem[];
  movies: TMDBMediaItem[];
  tvShows: TMDBMediaItem[];
  anime: TMDBMediaItem[];
  cartoons: TMDBMediaItem[];
  topRatedMovies: TMDBMediaItem[];
  topRatedTV: TMDBMediaItem[];
  upcoming: TMDBMediaItem[];
  genres: { movie: TMDBGenre[]; tv: TMDBGenre[] };
}

export interface ContinueWatchingItem {
  media: TMDBMediaItem;
  season: number;
  episode: number;
  serverId: string;
  progress: number; // 0..1 (best-effort)
  updatedAt: number;
}
