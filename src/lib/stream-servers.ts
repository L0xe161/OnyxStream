import type { MediaType } from "./types";

export interface StreamParams {
  tmdbId: number | string;
  type: MediaType;
  season?: number;
  episode?: number;
}

export interface StreamServerOption {
  id: string;
  name: string;
  nameAr: string;
}

/**
 * There is exactly one streaming server / player configuration in the product:
 * EmbedMaster with the custom player id `v26aoqtvf3y89o0d78`. There are no
 * server tabs, no fallback chain, and no subtitle injection — the embed's own
 * built-in controls handle playback, resizing and fullscreen.
 */
export const STREAM_SERVERS: StreamServerOption[] = [
  { id: "embedmaster", name: "EmbedMaster", nameAr: "إمبيد ماستر" },
];

export const DEFAULT_SERVER_ID = "embedmaster";

export function getServerById(_id?: string): StreamServerOption {
  return STREAM_SERVERS[0];
}

const EMBEDMASTER_PLAYER_ID = "v26aoqtvf3y89o0d78";

/**
 * Builds the single EmbedMaster iframe URL. The player id is appended as a
 * query parameter; movies and TV use the documented path shape.
 */
export function buildStreamUrl(_serverId: string, params: StreamParams): string {
  const { tmdbId, type, season = 1, episode = 1 } = params;
  const base = type === "movie"
    ? `https://embedmaster.link/movie/${tmdbId}`
    : `https://embedmaster.link/tv/${tmdbId}/${season}/${episode}`;
  return `${base}?player_id=${EMBEDMASTER_PLAYER_ID}`;
}
